import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/error.js";
import { ErrorEvent } from "../models/ErrorEvent.js";
import { fingerprintOf, recordError, scrub } from "../services/errorTracker.js";
import { AppError } from "../utils/errors.js";
import { resolveRequestId } from "../utils/requestId.js";
import { signAccessToken } from "../utils/tokens.js";
import { mockUser } from "./helpers.js";

const app = createApp();
const token = signAccessToken("507f1f77bcf86cd799439011");
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INITIAL_ALERT_EMAIL = env.ALERT_EMAIL;
const INITIAL_CONTACT_EMAIL = env.CONTACT_EMAIL;

afterEach(() => {
  env.NODE_ENV = "test";
  env.ALERT_EMAIL = INITIAL_ALERT_EMAIL;
  env.CONTACT_EMAIL = INITIAL_CONTACT_EMAIL;
  vi.restoreAllMocks();
});

describe("health checks", () => {
  it("liveness answers without touching the database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("readiness reports degraded when the database is not connected", async () => {
    const res = await request(app).get("/api/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded" });
  });
});

describe("request id", () => {
  it("generates a distinct UUID v4 when no incoming X-Request-Id is provided", async () => {
    const first = await request(app).get("/api/health");
    const second = await request(app).get("/api/health");
    expect(first.headers["x-request-id"]).toMatch(UUID_V4_RE);
    expect(second.headers["x-request-id"]).toMatch(UUID_V4_RE);
    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });

  it("preserves a valid incoming X-Request-Id up to 64 allowed characters", async () => {
    const validId = "req-ABC123-" + "x".repeat(53);
    expect(validId).toHaveLength(64);
    const res = await request(app).get("/api/health").set("X-Request-Id", validId);
    expect(res.headers["x-request-id"]).toBe(validId);
  });

  it("replaces malformed incoming X-Request-Id values and never echoes them", async () => {
    for (const bad of [
      "bad id with spaces",
      "<script>alert(1)</script>",
      "bad_underscore",
      "a.b",
    ]) {
      const res = await request(app).get("/api/health").set("X-Request-Id", bad);
      expect(res.headers["x-request-id"]).toMatch(UUID_V4_RE);
      expect(res.headers["x-request-id"]).not.toBe(bad);
      expect(JSON.stringify(res.body)).not.toContain(bad);
    }
  });

  it("replaces an oversized incoming X-Request-Id", async () => {
    const oversized = "a".repeat(65);
    const res = await request(app).get("/api/health").set("X-Request-Id", oversized);
    expect(res.headers["x-request-id"]).toMatch(UUID_V4_RE);
    expect(res.headers["x-request-id"]).not.toBe(oversized);
  });

  it("replaces empty and ambiguous incoming X-Request-Id values", async () => {
    const emptyRes = await request(app).get("/api/health").set("X-Request-Id", "");
    expect(emptyRes.headers["x-request-id"]).toMatch(UUID_V4_RE);

    const joinedRes = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "first-id, second-id");
    expect(joinedRes.headers["x-request-id"]).toMatch(UUID_V4_RE);
    expect(joinedRes.headers["x-request-id"]).not.toContain("first-id");

    expect(resolveRequestId(["first-id", "second-id"])).toMatch(UUID_V4_RE);
  });

  it("includes X-Request-Id on auth, validation, 404, CORS preflight and 5xx responses", async () => {
    const responses = await Promise.all([
      request(app).get("/api/posts"),
      request(app).post("/api/auth/register").send({ username: "a" }),
      request(app).get("/api/does-not-exist"),
      request(app)
        .options("/api/health")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET"),
      request(app).get("/api/health/ready"),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 400, 404, 204, 503]);
    for (const res of responses) {
      expect(res.headers["x-request-id"]).toMatch(UUID_V4_RE);
    }
  });

  it("matches the X-Request-Id header with 500 JSON body, logs and error tracker", async () => {
    env.NODE_ENV = "production";
    env.ALERT_EMAIL = undefined;
    env.CONTACT_EMAIL = undefined;
    mockUser({ role: "admin", banned: false });
    vi.spyOn(ErrorEvent, "find").mockImplementation(() => {
      throw new Error("secret db crash");
    });
    vi.spyOn(ErrorEvent, "findOneAndUpdate").mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    vi.spyOn(ErrorEvent, "estimatedDocumentCount").mockResolvedValue(0);
    const createSpy = vi.spyOn(ErrorEvent, "create").mockResolvedValue({} as never);

    const res = await request(app)
      .get("/api/admin/errors")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "trace-500-abc");

    expect(res.status).toBe(500);
    expect(res.headers["x-request-id"]).toBe("trace-500-abc");
    expect(res.body).toEqual({ error: "Internal server error", requestId: "trace-500-abc" });
    expect(JSON.stringify(res.body)).not.toContain("secret db crash");

    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({
      source: "api",
      status: 500,
      requestId: "trace-500-abc",
    });
  });

  it("includes requestId in 5xx AppError responses and request-scoped error logs", () => {
    const logError = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    errorHandler(
      new AppError(502, "Upstream unavailable"),
      { id: "req-502-id", log: { error: logError } } as never,
      { status } as never,
      vi.fn(),
    );
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({ error: "Upstream unavailable", requestId: "req-502-id" });
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-502-id" }),
      "Server error",
    );
  });
});

describe("error scrubbing and grouping", () => {
  it("ignores requestId when computing error fingerprints", () => {
    const a = fingerprintOf({
      source: "api",
      message: "boom",
      route: "GET /posts",
      requestId: "req-1",
    });
    const b = fingerprintOf({
      source: "api",
      message: "boom",
      route: "GET /posts",
      requestId: "req-2",
    });
    expect(a).toBe(b);
  });

  it("updates grouped records with the latest valid requestId and drops malformed ones", async () => {
    env.NODE_ENV = "production";
    env.ALERT_EMAIL = undefined;
    env.CONTACT_EMAIL = undefined;
    const updateSpy = vi.spyOn(ErrorEvent, "findOneAndUpdate").mockReturnValue({
      lean: () => Promise.resolve({ _id: "existing" }),
    } as never);
    const createSpy = vi.spyOn(ErrorEvent, "create").mockResolvedValue({} as never);

    await recordError({
      source: "api",
      message: "boom",
      route: "GET /posts",
      status: 500,
      requestId: "valid-latest-id",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      { fingerprint: expect.any(String) },
      {
        $inc: { count: 1 },
        $set: {
          lastSeen: expect.any(Date),
          resolved: false,
          requestId: "valid-latest-id",
        },
      },
    );
    expect(createSpy).not.toHaveBeenCalled();

    updateSpy.mockClear();
    await recordError({
      source: "api",
      message: "boom",
      route: "GET /posts",
      status: 500,
      requestId: "bad id <script>",
    });

    const updateSet = (updateSpy.mock.calls[0]?.[1] as { $set: Record<string, unknown> }).$set;
    expect(updateSet.requestId).toBeUndefined();
  });
  it("removes tokens, emails and query values", () => {
    const out = scrub("Bearer abc.def.ghi for sam@example.com at /x?token=secret&a=1");
    expect(out).not.toMatch(/abc\.def|sam@example|secret/);
  });

  it("groups the same error for different ids", () => {
    const a = fingerprintOf({
      source: "api",
      message: "Cannot find 507f1f77bcf86cd799439011",
      route: "GET /posts/:id",
    });
    const b = fingerprintOf({
      source: "api",
      message: "Cannot find 507f1f77bcf86cd799439012",
      route: "GET /posts/:id",
    });
    expect(a).toBe(b);
  });

  it("separates different errors and sources", () => {
    const a = fingerprintOf({ source: "api", message: "boom", route: "/a" });
    expect(fingerprintOf({ source: "web", message: "boom", route: "/a" })).not.toBe(a);
    expect(fingerprintOf({ source: "api", message: "other", route: "/a" })).not.toBe(a);
  });
});

describe("POST /api/client-errors", () => {
  it("accepts a valid report", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .send({ message: "x is not a function", source: "window", path: "/explore" });
    expect(res.status).toBe(204);
  });

  it("rejects an invalid report", async () => {
    const res = await request(app).post("/api/client-errors").send({ message: "", source: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("admin error list", () => {
  it("requires a login", async () => {
    expect((await request(app).get("/api/admin/errors")).status).toBe(401);
  });

  it("is closed to regular users", async () => {
    const res = await request(app).get("/api/admin/errors").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("lists open errors for an admin", async () => {
    mockUser({ role: "admin", banned: false });
    const row = {
      _id: new mongoose.Types.ObjectId(),
      source: "web",
      message: "boom",
      route: "/",
      count: 3,
      firstSeen: new Date(),
      lastSeen: new Date(),
      resolved: false,
    };
    const chain: Record<string, unknown> = {};
    chain.sort = () => chain;
    chain.limit = () => chain;
    chain.lean = () => Promise.resolve([row]);
    vi.spyOn(ErrorEvent, "find").mockReturnValue(chain as never);
    const res = await request(app).get("/api/admin/errors").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ message: "boom", count: 3, source: "web" });
  });
});
