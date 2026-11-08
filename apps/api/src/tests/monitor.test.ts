import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { ErrorEvent } from "../models/ErrorEvent.js";
import { fingerprintOf, scrub } from "../services/errorTracker.js";
import { signAccessToken } from "../utils/tokens.js";
import { mockUser } from "./helpers.js";

const app = createApp();
const token = signAccessToken("507f1f77bcf86cd799439011");

afterEach(() => {
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

  it("sends a request id on every response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});

describe("error scrubbing and grouping", () => {
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
