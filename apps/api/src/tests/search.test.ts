import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchQuerySchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { Purchase } from "../models/Purchase.js";
import { User } from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const ME = new mongoose.Types.ObjectId().toString();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mimics the Mongoose query chain: every step returns the same object, `lean` resolves. */
function queryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const step of ["sort", "skip", "limit", "select", "populate"]) {
    chain[step] = vi.fn(() => chain);
  }
  chain.lean = () => Promise.resolve(result);
  return chain;
}

describe("escapeRegex", () => {
  it("neutralises regex characters", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(new RegExp(`^${escapeRegex("(x)+")}`).test("(x)+")).toBe(true);
  });
});

describe("searchQuerySchema", () => {
  it("trims, requires 2+ characters and bounds the page", () => {
    expect(searchQuerySchema.parse({ q: "  sam  " })).toEqual({ q: "sam", page: 1 });
    expect(searchQuerySchema.safeParse({ q: "a" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "x".repeat(51) }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "sam", page: "11" }).success).toBe(false);
  });
});

describe("search routes", () => {
  it("require a login", async () => {
    expect((await request(app).get("/api/search/users?q=sam")).status).toBe(401);
    expect((await request(app).get("/api/search/posts?q=sam")).status).toBe(401);
  });

  it("reject a missing or too-short query", async () => {
    expect((await request(app).get("/api/search/users").set(auth)).status).toBe(400);
    expect((await request(app).get("/api/search/posts?q=a").set(auth)).status).toBe(400);
  });
});

describe("GET /api/search/users", () => {
  it("matches usernames by escaped prefix and hides suspended accounts", async () => {
    const find = vi.spyOn(User, "find").mockReturnValue(
      queryChain([
        { _id: new mongoose.Types.ObjectId(), username: "sam_dev", bio: "hi", avatarUrl: null },
      ]) as never,
    );
    const res = await request(app).get("/api/search/users?q=sa.m").set(auth);
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({
      username: { $regex: "^sa\\.m", $options: "i" },
      banned: { $ne: true },
    });
    expect(res.body.items).toEqual([
      { id: expect.any(String), username: "sam_dev", bio: "hi", avatarUrl: null, plus: false },
    ]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("reports a next page when there are more than 20 results", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      username: `sam${i}`,
      bio: "",
      avatarUrl: null,
    }));
    vi.spyOn(User, "find").mockReturnValue(queryChain(rows) as never);
    const res = await request(app).get("/api/search/users?q=sam").set(auth);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.nextCursor).toBe("2");
  });
});

describe("GET /api/search/posts", () => {
  const author = { _id: new mongoose.Types.ObjectId(), username: "sam", avatarUrl: null };
  const base = {
    imageUrl: null,
    author,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date(),
  };

  it("uses a text search and never leaks locked content", async () => {
    const free = { ...base, _id: new mongoose.Types.ObjectId(), content: "hello world" };
    const paid = {
      ...base,
      _id: new mongoose.Types.ObjectId(),
      content: "hello teaser",
      priceCents: 500,
      premiumContent: "TOP SECRET TEXT",
    };
    const find = vi.spyOn(Post, "find").mockReturnValue(queryChain([free, paid]) as never);
    vi.spyOn(Like, "find").mockReturnValue(queryChain([]) as never);
    vi.spyOn(Purchase, "find").mockReturnValue(queryChain([]) as never);

    const res = await request(app).get("/api/search/posts?q=hello").set(auth);
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith(
      { $text: { $search: "hello" } },
      { score: { $meta: "textScore" } },
    );
    expect(res.body.items).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain("TOP SECRET TEXT");
    expect(res.body.items[1].locked).toBe(true);
  });
});
