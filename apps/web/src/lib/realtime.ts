import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import type { MessageNewEvent, MessageReadEvent, PresenceEvent, TypingEvent } from "@commune/shared";
import { getAccessToken, tryRefresh } from "./api";

/**
 * Live connection to the realtime (Socket.IO) service.
 *
 * Sending and saving still go through the normal API; this connection only delivers events
 * (new messages, "seen", typing, who is online, notifications). If it is not configured or drops,
 * the app keeps working by polling, and everything is refetched when the connection returns.
 */
const URL = import.meta.env.VITE_REALTIME_URL?.trim().replace(/\/+$/, "");
export const realtimeEnabled = Boolean(URL);

const TYPING_SHOWN_MS = 4000;

// ---- A tiny store so components can react to connection, typing and presence changes. ----
interface State {
  connected: boolean;
  /** conversation id -> the other person is typing */
  typing: Record<string, boolean>;
  /** user id -> online (only known for people in conversations that are open) */
  presence: Record<string, boolean>;
}
let state: State = { connected: false, typing: {}, presence: {} };
const listeners = new Set<() => void>();
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useRealtime<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}
/** For code that is not a component (for example a query's refetch interval). */
export const isRealtimeConnected = () => state.connected;

// ---- Connection ----
export interface RealtimeHandlers {
  onMessage: (e: MessageNewEvent) => void;
  onRead: (e: MessageReadEvent) => void;
  onNotification: () => void;
  /** After a reconnect, so anything missed while offline can be refetched. */
  onResync: () => void;
}

let socket: Socket | null = null;
let hasConnectedBefore = false;
const wanted = new Set<string>(); // conversations the screen currently shows
const typingTimers = new Map<string, number>();
let authFailures = 0;

function joinNow(id: string) {
  socket?.emit("conversation:join", { conversationId: id }, (res: { ok: boolean; online?: boolean }) => {
    // The answer says whether the other person is online right now; presence events do the rest.
    void res;
  });
}

async function renewAndReconnect() {
  if (!socket || socket.active) return;
  // Repeated refusals (for example a suspended account) back off instead of hammering.
  authFailures += 1;
  if (authFailures > 3) {
    window.setTimeout(() => {
      authFailures = 0;
    }, 60_000);
    return;
  }
  if (await tryRefresh()) socket.connect();
}

export function startRealtime(handlers: RealtimeHandlers): void {
  if (!URL || socket) return;
  const s = io(URL, {
    // A function, so every (re)connect uses the newest access token.
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ["websocket", "polling"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  socket = s;

  s.on("connect", () => {
    authFailures = 0;
    setState({ connected: true });
    for (const id of wanted) joinNow(id);
    if (hasConnectedBefore) handlers.onResync();
    hasConnectedBefore = true;
  });
  s.on("disconnect", (reason) => {
    setState({ connected: false, presence: {}, typing: {} });
    // The server ends a connection when its token expires: renew and come back.
    if (reason === "io server disconnect") void renewAndReconnect();
  });
  s.on("connect_error", (err) => {
    setState({ connected: false });
    if (err.message === "unauthorized") void renewAndReconnect();
  });

  s.on("message:new", handlers.onMessage);
  s.on("message:read", handlers.onRead);
  s.on("notification:new", handlers.onNotification);
  s.on("typing", (e: TypingEvent) => {
    window.clearTimeout(typingTimers.get(e.conversationId));
    setState({ typing: { ...state.typing, [e.conversationId]: e.typing } });
    if (e.typing) {
      // If the "stopped typing" event is lost, hide the indicator by itself.
      typingTimers.set(
        e.conversationId,
        window.setTimeout(() => setState({ typing: { ...state.typing, [e.conversationId]: false } }), TYPING_SHOWN_MS),
      );
    }
  });
  s.on("presence", (e: PresenceEvent) => {
    setState({ presence: { ...state.presence, [e.userId]: e.online } });
  });
}

export function stopRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  hasConnectedBefore = false;
  wanted.clear();
  typingTimers.forEach((t) => window.clearTimeout(t));
  typingTimers.clear();
  state = { connected: false, typing: {}, presence: {} };
  listeners.forEach((l) => l());
}

/** Tells the service this screen is showing a conversation (to receive typing and presence). */
export function joinConversation(id: string): () => void {
  wanted.add(id);
  if (socket?.connected) joinNow(id);
  return () => {
    wanted.delete(id);
    stopTyping(id);
    socket?.emit("conversation:leave", { conversationId: id });
  };
}

// ---- Typing: sent at most every 2.5 seconds, and stopped after 4 seconds without typing. ----
const lastTypingSent = new Map<string, number>();
const stopTimers = new Map<string, number>();

export function noteTyping(id: string): void {
  if (!socket?.connected) return;
  const now = Date.now();
  if (now - (lastTypingSent.get(id) ?? 0) > 2500) {
    socket.emit("typing", { conversationId: id, typing: true });
    lastTypingSent.set(id, now);
  }
  window.clearTimeout(stopTimers.get(id));
  stopTimers.set(id, window.setTimeout(() => stopTyping(id), 4000));
}

export function stopTyping(id: string): void {
  window.clearTimeout(stopTimers.get(id));
  stopTimers.delete(id);
  if (lastTypingSent.has(id)) {
    lastTypingSent.delete(id);
    socket?.emit("typing", { conversationId: id, typing: false });
  }
}
