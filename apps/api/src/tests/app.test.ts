import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { signAccessToken, verifyAccessToken, hashToken } from "../utils/tokens.js";

const app = createApp();

describe("health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("auth validation", () => {
  it("rejects a bad registration payload", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "a", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{oops");
    expect(res.status).toBe(400);
  });
});

describe("protected routes", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/api/posts").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });
});

describe("unknown routes", () => {
  it("returns 404 json", async () => {
    const res = await request(app).get("/api/nothing-here");
    expect(res.status).toBe(404);
  });
});

describe("tokens", () => {
  it("round-trips an access token", () => {
    const token = signAccessToken("user-123");
    expect(verifyAccessToken(token)).toBe("user-123");
  });

  it("hashes refresh tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
