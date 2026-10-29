import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { signAccessToken, verifyAccessToken } from "../utils/tokens.js";

const app = createApp();

describe("API responses", () => {
  it("are marked uncacheable", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("send hardening headers and hide the framework", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeTruthy();
  });

  it("reject oversized bodies cleanly", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("Request is too large");
  });
});

describe("access tokens", () => {
  it("refuse a token signed with another algorithm", () => {
    const forged = jwt.sign({ sub: "u1" }, "test-secret-test-secret-test-secret-123", { algorithm: "HS512" });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it("refuse an unsigned token", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url");
    expect(() => verifyAccessToken(`${header}.${body}.`)).toThrow();
  });
});

describe("input handling", () => {
  it("rejects operator objects where a string is expected", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: "" }, password: { $ne: "" } });
    expect(res.status).toBe(400);
  });
});
