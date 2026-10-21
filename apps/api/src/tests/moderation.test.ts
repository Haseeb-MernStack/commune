import { afterEach, describe, expect, it, vi } from "vitest";
import {
  banUserSchema,
  createReportSchema,
  reportQuerySchema,
  resolveReportSchema,
} from "@commune/shared";
import { createApp } from "../app.js";
import { signAccessToken } from "../utils/tokens.js";
import { call, mockUser } from "./helpers.js";

const app = createApp();
const token = signAccessToken("507f1f77bcf86cd799439011");
const POST_ID = "507f1f77bcf86cd799439012";

afterEach(() => {
  vi.restoreAllMocks();
});

const adminRoutes: Array<["get" | "post", string]> = [
  ["get", "/api/admin/reports"],
  ["post", "/api/admin/reports/507f1f77bcf86cd799439012/dismiss"],
  ["post", "/api/admin/reports/507f1f77bcf86cd799439012/resolve"],
  ["post", "/api/admin/users/someone/ban"],
  ["post", "/api/admin/users/someone/unban"],
];

describe("admin routes", () => {
  it.each(adminRoutes)("%s %s requires a token", async (method, path) => {
    const res = await call(app, method, path);
    expect(res.status).toBe(401);
  });

  it.each(adminRoutes)("%s %s is forbidden for regular users", async (method, path) => {
    mockUser({ role: "user", banned: false });
    const res = await call(app, method, path, token);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admins only/i);
  });

  it("is forbidden for a suspended admin", async () => {
    mockUser({ role: "admin", banned: true });
    const res = await call(app, "get", "/api/admin/reports", token);
    expect(res.status).toBe(403);
  });

  it("rejects an unknown report status for admins", async () => {
    mockUser({ role: "admin", banned: false });
    const res = await call(app, "get", "/api/admin/reports?status=bogus", token);
    expect(res.status).toBe(400);
  });

  it("rejects an unknown resolve action for admins", async () => {
    mockUser({ role: "admin", banned: false });
    const res = await call(app, "post", `/api/admin/reports/${POST_ID}/resolve`, token).send({
      action: "delete_everything",
    });
    expect(res.status).toBe(400);
  });
});

describe("suspended users", () => {
  it("cannot create posts", async () => {
    mockUser({ role: "user", banned: true });
    const res = await call(app, "post", "/api/posts", token).send({ content: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended/i);
  });

  it("cannot comment, like, follow or report", async () => {
    mockUser({ role: "user", banned: true });
    const attempts = [
      call(app, "post", `/api/posts/${POST_ID}/comments`, token).send({ content: "hi" }),
      call(app, "post", `/api/posts/${POST_ID}/like`, token),
      call(app, "post", "/api/users/someone/follow", token),
      call(app, "post", `/api/posts/${POST_ID}/report`, token).send({ reason: "spam" }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
    }
  });

  it("are rejected when the account no longer exists", async () => {
    mockUser(null);
    const res = await call(app, "post", "/api/posts", token).send({ content: "hello" });
    expect(res.status).toBe(401);
  });
});

describe("reporting", () => {
  it("requires login", async () => {
    const res = await call(app, "post", `/api/posts/${POST_ID}/report`).send({ reason: "spam" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown reason", async () => {
    const res = await call(app, "post", `/api/posts/${POST_ID}/report`, token).send({
      reason: "i-just-dislike-it",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed post id", async () => {
    mockUser({ role: "user", banned: false });
    const res = await call(app, "post", "/api/posts/not-an-id/report", token).send({
      reason: "spam",
    });
    expect(res.status).toBe(400);
  });
});

describe("moderation schemas", () => {
  it("accepts every documented reason and trims details", () => {
    for (const reason of ["spam", "harassment", "hate", "violence", "other"]) {
      expect(createReportSchema.safeParse({ reason }).success).toBe(true);
    }
    expect(createReportSchema.parse({ reason: "spam", details: "  bad  " }).details).toBe("bad");
  });

  it("limits report details to 300 characters", () => {
    expect(createReportSchema.safeParse({ reason: "spam", details: "x".repeat(301) }).success).toBe(
      false,
    );
  });

  it("only allows the two resolve actions", () => {
    expect(resolveReportSchema.safeParse({ action: "remove_post" }).success).toBe(true);
    expect(resolveReportSchema.safeParse({ action: "remove_post_and_ban" }).success).toBe(true);
    expect(resolveReportSchema.safeParse({ action: "ban_forever" }).success).toBe(false);
  });

  it("defaults the report queue to open and removePosts to false", () => {
    expect(reportQuerySchema.parse({}).status).toBe("open");
    expect(banUserSchema.parse({}).removePosts).toBe(false);
  });
});
