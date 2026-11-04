import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedPushEndpoint, pushSubscribeSchema } from "@commune/shared";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

const { createApp } = await import("../app.js");
const { env } = await import("../config/env.js");
const { PushSubscription } = await import("../models/PushSubscription.js");
const { User } = await import("../models/User.js");
const { pushToUser } = await import("../services/pushService.js");
const { resetRealtimeBreaker } = await import("../services/realtime.js");
const { signAccessToken } = await import("../utils/tokens.js");

const app = createApp();
const ME = new mongoose.Types.ObjectId().toString();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };
const P256 = "B".repeat(87);
const AUTH_KEY = "a".repeat(22);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const leanOf = (value: unknown) => ({ lean: () => Promise.resolve(value) });
const configure = (on: boolean) => {
  (env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY = on ? "pub" : undefined;
  (env as { VAPID_PRIVATE_KEY?: string }).VAPID_PRIVATE_KEY = on ? "priv" : undefined;
};

beforeEach(() => {
  resetRealtimeBreaker();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  configure(false);
  (env as { REALTIME_URL?: string }).REALTIME_URL = undefined;
  (env as { REALTIME_SECRET?: string }).REALTIME_SECRET = undefined;
});

describe("push endpoint allowlist (the server calls these addresses)", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/x",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("accepts %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/x",
    "https://evil.example/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilfcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "not a url",
  ])("rejects %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(false));

  it("validates keys", () => {
    expect(pushSubscribeSchema.safeParse({ endpoint: ENDPOINT, keys: { p256dh: P256, auth: AUTH_KEY } }).success).toBe(true);
    expect(pushSubscribeSchema.safeParse({ endpoint: ENDPOINT, keys: { p256dh: "x", auth: AUTH_KEY } }).success).toBe(false);
  });
});

describe("push routes", () => {
  it("require a login", async () => {
    expect((await request(app).get("/api/push/status")).status).toBe(401);
    expect((await request(app).post("/api/push/subscribe").send({})).status).toBe(401);
  });

  it("report that push is off when no keys are set", async () => {
    vi.spyOn(User, "findById").mockImplementation((() => ({ select: () => leanOf({}) })) as never);
    const res = await request(app).get("/api/push/status").set(auth);
    expect(res.body).toMatchObject({ enabled: false, publicKey: null, preferences: { messages: true, social: true } });
  });

  it("hand out the public key and saved preferences when push is on", async () => {
    configure(true);
    vi.spyOn(User, "findById").mockImplementation((() => ({ select: () => leanOf({ pushMessages: false }) })) as never);
    const res = await request(app).get("/api/push/status").set(auth);
    expect(res.body).toMatchObject({ enabled: true, publicKey: "pub", preferences: { messages: false, social: true } });
  });

  it("refuse a subscription pointing at an arbitrary address", async () => {
    configure(true);
    const res = await request(app)
      .post("/api/push/subscribe")
      .set(auth)
      .send({ endpoint: "https://evil.example/hook", keys: { p256dh: P256, auth: AUTH_KEY } });
    expect(res.status).toBe(400);
  });

  it("save a valid subscription for the signed-in user", async () => {
    configure(true);
    const upsert = vi.spyOn(PushSubscription, "findOneAndUpdate").mockResolvedValue({} as never);
    vi.spyOn(PushSubscription, "countDocuments").mockResolvedValue(1 as never);
    const res = await request(app)
      .post("/api/push/subscribe")
      .set(auth)
      .send({ endpoint: ENDPOINT, keys: { p256dh: P256, auth: AUTH_KEY } });
    expect(res.status).toBe(204);
    const [filter, update] = upsert.mock.calls[0] as unknown as [{ endpoint: string }, { $set: { user: string } }];
    expect(filter.endpoint).toBe(ENDPOINT);
    expect(update.$set.user).toBe(ME);
  });

  it("only remove the caller's own subscription", async () => {
    const del = vi.spyOn(PushSubscription, "deleteOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/push/unsubscribe").set(auth).send({ endpoint: ENDPOINT });
    expect(res.status).toBe(204);
    expect(del).toHaveBeenCalledWith({ user: ME, endpoint: ENDPOINT });
  });

  it("save preferences", async () => {
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).put("/api/push/preferences").set(auth).send({ messages: false, social: true });
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ _id: ME }, { $set: { pushMessages: false, pushSocial: true } });
    expect((await request(app).put("/api/push/preferences").set(auth).send({ messages: "no" })).status).toBe(400);
  });
});

describe("pushToUser", () => {
  const payload = { title: "@sam", body: "hello", url: "/messages/1", tag: "msg-1" };
  const sub = { _id: "s1", endpoint: ENDPOINT, p256dh: P256, auth: AUTH_KEY };
  const prefs = (value: unknown) =>
    vi.spyOn(User, "findById").mockImplementation((() => ({ select: () => leanOf(value) })) as never);
  const subs = (value: unknown[]) =>
    vi.spyOn(PushSubscription, "find").mockImplementation((() => leanOf(value)) as never);

  it("does nothing without VAPID keys", async () => {
    subs([sub]);
    await pushToUser(ME, "message", payload);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends to every device with the notification text", async () => {
    configure(true);
    prefs({ pushMessages: true });
    subs([sub, { ...sub, _id: "s2", endpoint: ENDPOINT + "2" }]);
    await pushToUser(ME, "message", payload);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [target, body] = sendNotification.mock.calls[0] as unknown as [{ endpoint: string }, string];
    expect(target.endpoint).toBe(ENDPOINT);
    expect(JSON.parse(body)).toEqual(payload);
  });

  it("respects the person's choices and suspensions", async () => {
    configure(true);
    subs([sub]);
    prefs({ pushMessages: false });
    await pushToUser(ME, "message", payload);
    prefs({ pushSocial: false });
    await pushToUser(ME, "social", payload);
    prefs({ banned: true });
    await pushToUser(ME, "message", payload);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips people who are looking at the site right now", async () => {
    configure(true);
    (env as { REALTIME_URL?: string }).REALTIME_URL = "http://realtime.test";
    (env as { REALTIME_SECRET?: string }).REALTIME_SECRET = "r".repeat(40);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ active: [ME] }), { status: 200 })));
    prefs({});
    subs([sub]);
    await pushToUser(ME, "message", payload);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("still sends when the realtime service is unreachable", async () => {
    configure(true);
    (env as { REALTIME_URL?: string }).REALTIME_URL = "http://realtime.test";
    (env as { REALTIME_SECRET?: string }).REALTIME_SECRET = "r".repeat(40);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("down");
    }));
    prefs({});
    subs([sub]);
    await pushToUser(ME, "message", payload);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("removes devices the push service says are gone, and never throws", async () => {
    configure(true);
    prefs({});
    subs([sub]);
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const del = vi.spyOn(PushSubscription, "deleteOne").mockResolvedValue({} as never);
    await expect(pushToUser(ME, "message", payload)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith({ _id: "s1" });
  });

  it("the test notification ignores preferences", async () => {
    configure(true);
    prefs({ pushMessages: false, pushSocial: false });
    subs([sub]);
    await pushToUser(ME, "test", payload);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
