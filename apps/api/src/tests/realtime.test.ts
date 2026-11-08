import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { Conversation } from "../models/Conversation.js";
import { disconnectUser, emitToUsers, resetRealtimeBreaker } from "../services/realtime.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = oid().toString();
const OTHER = oid();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };
const SECRET = "r".repeat(40);
const leanOf = (value: unknown) => ({ lean: () => Promise.resolve(value) });

function enableRealtime() {
  (env as { REALTIME_URL?: string }).REALTIME_URL = "http://realtime.test";
  (env as { REALTIME_SECRET?: string }).REALTIME_SECRET = SECRET;
}

beforeEach(() => {
  resetRealtimeBreaker();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (env as { REALTIME_URL?: string }).REALTIME_URL = undefined;
  (env as { REALTIME_SECRET?: string }).REALTIME_SECRET = undefined;
});

describe("realtime bridge", () => {
  it("does nothing when the realtime service is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await emitToUsers([ME], "message:new", {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the service with the shared secret and removes duplicate recipients", async () => {
    enableRealtime();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await emitToUsers([ME, ME, OTHER], "message:new", { hello: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://realtime.test/internal/emit");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(init.body as string)).toEqual({
      to: [ME, OTHER.toString()],
      event: "message:new",
      payload: { hello: 1 },
    });
  });

  it("never throws, and stops calling a service that is down for a while", async () => {
    enableRealtime();
    const fetchMock = vi.fn(async () => {
      throw new Error("down");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(emitToUsers([ME], "message:new")).resolves.toBeUndefined();
    await emitToUsers([ME], "message:new");
    await disconnectUser(ME);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/internal/conversations/:id/participants", () => {
  const id = oid().toString();

  it("is invisible without the secret", async () => {
    enableRealtime();
    expect((await request(app).get(`/api/internal/conversations/${id}/participants`)).status).toBe(
      404,
    );
    const wrong = await request(app)
      .get(`/api/internal/conversations/${id}/participants`)
      .set("Authorization", "Bearer nope");
    expect(wrong.status).toBe(404);
  });

  it("is invisible when realtime is not configured, even with a user token", async () => {
    const res = await request(app).get(`/api/internal/conversations/${id}/participants`).set(auth);
    expect(res.status).toBe(404);
  });

  it("returns the participants to the realtime service", async () => {
    enableRealtime();
    vi.spyOn(Conversation, "findById").mockImplementation((() => ({
      select: () => leanOf({ participants: [ME, OTHER] }),
    })) as never);
    const res = await request(app)
      .get(`/api/internal/conversations/${id}/participants`)
      .set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ participants: [ME, OTHER.toString()] });
  });
});

describe("POST /api/messages/:id/read", () => {
  const convoId = oid();

  it("requires a login", async () => {
    expect((await request(app).post(`/api/messages/${convoId}/read`)).status).toBe(401);
  });

  it("clears the unread count and tells the sender it was seen", async () => {
    enableRealtime();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Conversation, "findById").mockImplementation((() =>
      leanOf({
        _id: convoId,
        participants: [ME, OTHER],
        lastMessageAt: new Date(),
        unread: { [ME]: 3 },
      })) as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);

    const res = await request(app).post(`/api/messages/${convoId}/read`).set(auth);
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith(
      { _id: convoId.toString() },
      { $set: { [`unread.${ME}`]: 0 } },
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body).toMatchObject({
      to: [OTHER.toString()],
      event: "message:read",
      payload: { conversationId: convoId.toString(), readerId: ME },
    });
  });

  it("does nothing when there was nothing unread", async () => {
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);
    vi.spyOn(Conversation, "findById").mockImplementation((() =>
      leanOf({
        _id: convoId,
        participants: [ME, OTHER],
        lastMessageAt: new Date(),
        unread: {},
      })) as never);
    expect((await request(app).post(`/api/messages/${convoId}/read`).set(auth)).status).toBe(204);
    expect(update).not.toHaveBeenCalled();
  });

  it("404 for a conversation that is not yours", async () => {
    vi.spyOn(Conversation, "findById").mockImplementation((() =>
      leanOf({ _id: convoId, participants: [OTHER, oid()], lastMessageAt: new Date() })) as never);
    expect((await request(app).post(`/api/messages/${convoId}/read`).set(auth)).status).toBe(404);
  });
});
