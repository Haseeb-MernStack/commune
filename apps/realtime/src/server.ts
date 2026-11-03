import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Server, type Socket } from "socket.io";
import { bearer, safeEqual, verifyToken } from "./auth.js";
import type { Config } from "./config.js";
import { TokenBucket } from "./limits.js";
import { log } from "./log.js";
import { Membership } from "./membership.js";

/** Events the API is allowed to push to users. Anything else is refused. */
const PUSHABLE_EVENTS = new Set(["message:new", "message:read", "notification:new"]);

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_BODY_BYTES = 10_000;
const MAX_ROOMS_PER_SOCKET = 20;
const MAX_TARGETS_PER_EMIT = 10;

const userRoom = (userId: string) => `user:${userId}`;
const convRoom = (conversationId: string) => `conv:${conversationId}`;

interface SocketData {
  userId: string;
  conversations: Set<string>;
}

type Ack = (result: { ok: boolean; online?: boolean; error?: string }) => void;

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

/**
 * The realtime service: Socket.IO for browsers, plus a small private HTTP interface the API uses
 * to push events. REST stays the source of truth for sending and saving messages; sockets only
 * deliver, so if this service is down the app keeps working (by polling).
 */
export function createRealtimeServer(config: Config, membership?: Membership) {
  const members = membership ?? new Membership(config.apiUrl, config.internalSecret);
  /** user id -> ids of their open sockets (a person can have several tabs and devices). */
  const online = new Map<string, Set<string>>();

  const httpServer = http.createServer((req, res) => {
    void handleHttp(req, res).catch((err: unknown) => {
      log("error", "HTTP handler failed", { err: String(err) });
      if (!res.headersSent) send(res, 500, { error: "Internal error" });
    });
  });

  const io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: config.clientOrigin },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 10_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectTimeout: 10_000,
    // Browsers must come from the web app. Requests without an Origin are not browsers; they
    // still need a valid token below.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || origin === config.clientOrigin);
    },
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse) {
    const path = (req.url ?? "/").split("?")[0];

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return send(res, 200, { status: "ok" });
    }

    if (req.method === "POST" && (path === "/internal/emit" || path === "/internal/disconnect")) {
      if (!safeEqual(bearer(req.headers.authorization), config.internalSecret)) {
        return send(res, 401, { error: "Unauthorized" });
      }
      let body: unknown;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: "Invalid body" });
      }
      const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

      if (path === "/internal/disconnect") {
        if (typeof input.userId !== "string" || !OBJECT_ID.test(input.userId)) {
          return send(res, 400, { error: "Invalid user" });
        }
        io.in(userRoom(input.userId)).disconnectSockets(true);
        return send(res, 204);
      }

      const to = input.to;
      if (
        !Array.isArray(to) ||
        to.length === 0 ||
        to.length > MAX_TARGETS_PER_EMIT ||
        !to.every((id) => typeof id === "string" && OBJECT_ID.test(id))
      ) {
        return send(res, 400, { error: "Invalid recipients" });
      }
      if (typeof input.event !== "string" || !PUSHABLE_EVENTS.has(input.event)) {
        return send(res, 400, { error: "Unknown event" });
      }
      for (const id of new Set(to as string[])) io.to(userRoom(id)).emit(input.event, input.payload ?? {});
      return send(res, 204);
    }

    return send(res, 404, { error: "Not found" });
  }

  // ---- Connection authentication: a valid, unexpired access token or nothing. ----
  io.use((socket, next) => {
    const principal = verifyToken(socket.handshake.auth?.token, config.jwtSecret);
    if (!principal) return next(new Error("unauthorized"));
    if ((online.get(principal.userId)?.size ?? 0) >= config.maxConnectionsPerUser) {
      return next(new Error("too_many_connections"));
    }
    (socket.data as SocketData & { expiresAt: number }).userId = principal.userId;
    (socket.data as { expiresAt: number }).expiresAt = principal.expiresAt;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData & { expiresAt: number };
    const userId = data.userId;
    data.conversations = new Set();

    socket.join(userRoom(userId));
    const sockets = online.get(userId) ?? new Set<string>();
    sockets.add(socket.id);
    online.set(userId, sockets);

    // The connection is only as valid as the token. When it expires the client is dropped and
    // reconnects with a fresh one, so a stolen or revoked session cannot stay connected.
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, data.expiresAt - Date.now()) + 1000);
    expiryTimer.unref();

    const bucket = new TokenBucket(20, 5);

    socket.on("conversation:join", async (payload: unknown, ack?: Ack) => {
      const reply = typeof ack === "function" ? ack : () => undefined;
      const id = (payload as { conversationId?: unknown } | null)?.conversationId;
      if (typeof id !== "string" || !OBJECT_ID.test(id)) return reply({ ok: false, error: "invalid" });
      if (!bucket.take()) return reply({ ok: false, error: "rate_limited" });
      if (data.conversations.size >= MAX_ROOMS_PER_SOCKET && !data.conversations.has(id)) {
        return reply({ ok: false, error: "too_many" });
      }
      const participants = await members.participants(id);
      if (!participants?.includes(userId)) return reply({ ok: false, error: "forbidden" });

      await socket.join(convRoom(id));
      data.conversations.add(id);
      socket.to(convRoom(id)).emit("presence", { conversationId: id, userId, online: true });
      const other = participants.find((p) => p !== userId);
      reply({ ok: true, online: other ? (online.get(other)?.size ?? 0) > 0 : false });
    });

    socket.on("conversation:leave", (payload: unknown) => {
      const id = (payload as { conversationId?: unknown } | null)?.conversationId;
      if (typeof id !== "string" || !data.conversations.has(id)) return;
      data.conversations.delete(id);
      void socket.leave(convRoom(id));
    });

    socket.on("typing", (payload: unknown) => {
      const p = payload as { conversationId?: unknown; typing?: unknown } | null;
      if (typeof p?.conversationId !== "string" || typeof p.typing !== "boolean") return;
      // Only for conversations this socket was verified to belong to.
      if (!data.conversations.has(p.conversationId)) return;
      if (!bucket.take()) return;
      socket.to(convRoom(p.conversationId)).emit("typing", {
        conversationId: p.conversationId,
        userId,
        typing: p.typing,
      });
    });

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      const set = online.get(userId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        online.delete(userId);
        // Last tab or device closed: tell the people they were chatting with.
        for (const id of data.conversations) {
          io.to(convRoom(id)).emit("presence", { conversationId: id, userId, online: false });
        }
      }
    });
  });

  return {
    httpServer,
    io,
    /** Number of users with at least one open connection. */
    onlineUsers: () => online.size,
    close: () =>
      new Promise<void>((resolve) => {
        void io.close(() => resolve());
      }),
  };
}
