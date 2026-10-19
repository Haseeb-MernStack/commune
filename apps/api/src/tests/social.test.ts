import request from "supertest";
import { describe, expect, it } from "vitest";
import { paginationSchema, updateProfileSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();

describe("social routes require auth", () => {
  const protectedRoutes: Array<[string, string]> = [
    ["get", "/api/users/someone"],
    ["get", "/api/users/someone/posts"],
    ["post", "/api/users/someone/follow"],
    ["patch", "/api/users/me"],
    ["get", "/api/notifications"],
    ["get", "/api/notifications/unread-count"],
    ["post", "/api/notifications/read"],
  ];

  it.each(protectedRoutes)("%s %s returns 401 without a token", async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
      method
    ]!(path);
    expect(res.status).toBe(401);
  });
});

describe("profile validation", () => {
  const token = signAccessToken("507f1f77bcf86cd799439011");

  it("rejects a bio longer than 160 characters", async () => {
    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "x".repeat(161) });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown feed type", async () => {
    const res = await request(app)
      .get("/api/posts?feed=everything")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("shared schemas", () => {
  it("defaults the feed to 'all'", () => {
    expect(paginationSchema.parse({}).feed).toBe("all");
  });

  it("accepts the following feed", () => {
    expect(paginationSchema.parse({ feed: "following" }).feed).toBe("following");
  });

  it("trims and accepts a valid bio", () => {
    expect(updateProfileSchema.parse({ bio: "  hello  " }).bio).toBe("hello");
  });
});
