import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { Membership } from "../membership.js";
import { createRealtimeServer } from "../server.js";

const ALICE = "aaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const EVE = "eeeeeeeeeeeeeeeeeeeeeeee";
const CONVO = "cccccccccccccccccccccccc";

const config: Config = {
  port: 0,
  clientOrigin: "http://localhost:5173",
  jwtSecret: "j".repeat(40),
  internalSecret: "s".repeat(40),
  apiUrl: "http://api.test",
  maxConnectionsPerUser: 3,
};

// Stands in for the API: only ALICE and BOB are in CONVO.
const fakeFetch = async (url: string) => {
  if (url.includes(`/conversations/${CONVO}/participants`)) {
    return new Response(JSON.stringify({ participants: [ALICE, BOB] }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};

<<<<<<< HEAD
const server = createRealtimeServer(
  config,
  new Membership(config.apiUrl, config.internalSecret, fakeFetch as never),
);
=======
const server = createRealtimeServer(config, new Membership(config.apiUrl, config.internalSecret, fakeFetch as never));
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
let base = "";
const open: Socket[] = [];

const token = (sub: string, options: jwt.SignOptions = { expiresIn: "15m" }) =>
  jwt.sign({ sub }, config.jwtSecret, { algorithm: "HS256", ...options });

function client(auth: unknown): Socket {
<<<<<<< HEAD
  const s = connect(base, {
    auth: auth as Record<string, unknown>,
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
=======
  const s = connect(base, { auth: auth as Record<string, unknown>, transports: ["websocket"], reconnection: false, forceNew: true });
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
  open.push(s);
  return s;
}
const connected = (s: Socket) =>
  new Promise<void>((resolve, reject) => {
    s.once("connect", () => resolve());
    s.once("connect_error", (e) => reject(e));
  });
const next = <T>(s: Socket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 3000);
    s.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
const join = (s: Socket, conversationId: string) =>
  new Promise<{ ok: boolean; online?: boolean; error?: string }>((resolve) => {
    s.emit("conversation:join", { conversationId }, resolve);
  });
const emitViaApi = (body: unknown, secret = config.internalSecret) =>
  fetch(`${base}/internal/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});
afterEach(async () => {
  while (open.length) open.pop()?.close();
  // Give the server a moment to notice the closed sockets so connection counts start clean.
  await new Promise((r) => setTimeout(r, 80));
});
afterAll(async () => {
  await server.close();
});

describe("authentication", () => {
  it("refuses a connection without a token", async () => {
    await expect(connected(client({}))).rejects.toThrow("unauthorized");
  });

  it("refuses a bad signature, a wrong algorithm and an expired token", async () => {
<<<<<<< HEAD
    const forged = jwt.sign({ sub: ALICE }, "x".repeat(40), {
      algorithm: "HS256",
      expiresIn: "15m",
    });
    const wrongAlg = jwt.sign({ sub: ALICE }, config.jwtSecret, {
      algorithm: "HS512",
      expiresIn: "15m",
    });
=======
    const forged = jwt.sign({ sub: ALICE }, "x".repeat(40), { algorithm: "HS256", expiresIn: "15m" });
    const wrongAlg = jwt.sign({ sub: ALICE }, config.jwtSecret, { algorithm: "HS512", expiresIn: "15m" });
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
    const expired = token(ALICE, { expiresIn: -10 });
    for (const t of [forged, wrongAlg, expired]) {
      await expect(connected(client({ token: t }))).rejects.toThrow("unauthorized");
    }
  });

  it("refuses a token whose subject is not a user id", async () => {
    await expect(connected(client({ token: token("not-an-id") }))).rejects.toThrow("unauthorized");
  });

  it("accepts a valid token", async () => {
    await connected(client({ token: token(ALICE) }));
  });

  it("limits connections per user", async () => {
    for (let i = 0; i < 3; i++) await connected(client({ token: token(ALICE) }));
<<<<<<< HEAD
    await expect(connected(client({ token: token(ALICE) }))).rejects.toThrow(
      "too_many_connections",
    );
=======
    await expect(connected(client({ token: token(ALICE) }))).rejects.toThrow("too_many_connections");
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
  });

  it("refuses browsers from another origin", async () => {
    const s = connect(base, {
      auth: { token: token(ALICE) },
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      extraHeaders: { Origin: "https://evil.example" },
    });
    open.push(s);
    await expect(connected(s)).rejects.toBeTruthy();
  });
});

describe("internal emit", () => {
  it("delivers an event only to the addressed user", async () => {
    const alice = client({ token: token(ALICE) });
    const bob = client({ token: token(BOB) });
    await Promise.all([connected(alice), connected(bob)]);
    let bobGotIt = false;
    bob.on("message:new", () => (bobGotIt = true));

    const received = next<{ hello: string }>(alice, "message:new");
<<<<<<< HEAD
    const res = await emitViaApi({
      to: [ALICE],
      event: "message:new",
      payload: { hello: "world" },
    });
=======
    const res = await emitViaApi({ to: [ALICE], event: "message:new", payload: { hello: "world" } });
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
    expect(res.status).toBe(204);
    expect(await received).toEqual({ hello: "world" });
    await new Promise((r) => setTimeout(r, 100));
    expect(bobGotIt).toBe(false);
  });

  it("rejects a wrong secret, an unknown event and bad recipients", async () => {
<<<<<<< HEAD
    expect(
      (await emitViaApi({ to: [ALICE], event: "message:new" }, "wrong".repeat(10))).status,
    ).toBe(401);
=======
    expect((await emitViaApi({ to: [ALICE], event: "message:new" }, "wrong".repeat(10))).status).toBe(401);
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
    expect((await emitViaApi({ to: [ALICE], event: "admin:everything" })).status).toBe(400);
    expect((await emitViaApi({ to: ["nope"], event: "message:new" })).status).toBe(400);
    expect((await emitViaApi({ to: [], event: "message:new" })).status).toBe(400);
  });

  it("disconnects a user on request", async () => {
    const alice = client({ token: token(ALICE) });
    await connected(alice);
    const gone = next(alice, "disconnect");
    const res = await fetch(`${base}/internal/disconnect`, {
      method: "POST",
<<<<<<< HEAD
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.internalSecret}`,
      },
=======
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.internalSecret}` },
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
      body: JSON.stringify({ userId: ALICE }),
    });
    expect(res.status).toBe(204);
    await gone;
  });
});

describe("conversations, typing and presence", () => {
  it("lets members join and refuses outsiders", async () => {
    const alice = client({ token: token(ALICE) });
    const eve = client({ token: token(EVE) });
    await Promise.all([connected(alice), connected(eve)]);
    expect((await join(alice, CONVO)).ok).toBe(true);
    expect(await join(eve, CONVO)).toMatchObject({ ok: false, error: "forbidden" });
    expect((await join(alice, "not-an-id")).ok).toBe(false);
  });

  it("relays typing between members who joined", async () => {
    const alice = client({ token: token(ALICE) });
    const bob = client({ token: token(BOB) });
    await Promise.all([connected(alice), connected(bob)]);
    await join(alice, CONVO);
    await join(bob, CONVO);
    const got = next<{ userId: string; typing: boolean }>(bob, "typing");
    alice.emit("typing", { conversationId: CONVO, typing: true });
    expect(await got).toMatchObject({ conversationId: CONVO, userId: ALICE, typing: true });
  });

  it("ignores typing from someone who did not join", async () => {
    const bob = client({ token: token(BOB) });
    const eve = client({ token: token(EVE) });
    await Promise.all([connected(bob), connected(eve)]);
    await join(bob, CONVO);
    let seen = false;
    bob.on("typing", () => (seen = true));
    eve.emit("typing", { conversationId: CONVO, typing: true });
    await new Promise((r) => setTimeout(r, 150));
    expect(seen).toBe(false);
  });

  it("reports presence when someone joins and when their last connection closes", async () => {
    const alice = client({ token: token(ALICE) });
    await connected(alice);
    expect(await join(alice, CONVO)).toMatchObject({ ok: true, online: false });

    const bob = client({ token: token(BOB) });
    await connected(bob);
    const cameOnline = next<{ userId: string; online: boolean }>(alice, "presence");
    expect(await join(bob, CONVO)).toMatchObject({ ok: true, online: true });
    expect(await cameOnline).toMatchObject({ userId: BOB, online: true });

    const wentOffline = next<{ userId: string; online: boolean }>(alice, "presence");
    bob.close();
    expect(await wentOffline).toMatchObject({ userId: BOB, online: false });
  });
});

<<<<<<< HEAD
describe("active users (for push notifications)", () => {
  const activeVia = (userIds: string[]) =>
    fetch(`${base}/internal/active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.internalSecret}`,
      },
      body: JSON.stringify({ userIds }),
    });

  it("reports only users with a visible tab", async () => {
    const alice = client({ token: token(ALICE) });
    const bob = client({ token: token(BOB) });
    await Promise.all([connected(alice), connected(bob)]);
    alice.emit("visibility", { visible: true });
    bob.emit("visibility", { visible: false });
    await new Promise((r) => setTimeout(r, 100));
    const res = await activeVia([ALICE, BOB, EVE]);
    expect(await res.json()).toEqual({ active: [ALICE] });
  });

  it("stops counting a user when the tab closes", async () => {
    const alice = client({ token: token(ALICE) });
    await connected(alice);
    alice.emit("visibility", { visible: true });
    await new Promise((r) => setTimeout(r, 100));
    alice.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(await (await activeVia([ALICE])).json()).toEqual({ active: [] });
  });

  it("needs the secret and valid ids", async () => {
    expect((await activeVia(["nope"])).status).toBe(400);
    const res = await fetch(`${base}/internal/active`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });
});

=======
>>>>>>> c8c01b67633c93be2fc611c7c617accf40c84b39
describe("health", () => {
  it("answers without revealing anything", async () => {
    const res = await fetch(`${base}/health`);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
