import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Bookmark } from "../models/Bookmark.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { Purchase } from "../models/Purchase.js";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";

/** Fields that must never appear in a public API response, however deeply nested. */
const PRIVATE_KEYS = [
  "passwordHash",
  "password",
  "email",
  "refreshToken",
  "tokenHash",
  "googleId",
] as const;

/**
 * Fails the test when any key of `body` — at any depth, including inside arrays —
 * is one of the private fields. The mocked rows below carry those fields on purpose,
 * so a serializer that ever copies them through makes this fail.
 */
function expectNoKeys(body: unknown, keys: readonly string[]): void {
  if (Array.isArray(body)) {
    for (const item of body) expectNoKeys(item, keys);
    return;
  }
  if (body !== null && typeof body === "object") {
    for (const [key, value] of Object.entries(body)) {
      expect(keys).not.toContain(key);
      expectNoKeys(value, keys);
    }
  }
}

const app = createApp();
const ME = new mongoose.Types.ObjectId().toString();
const OTHER_ID = new mongoose.Types.ObjectId();
const POST_ID = new mongoose.Types.ObjectId();
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

/**
 * Another person's account, carrying the private fields the responses must never
 * expose. Every mocked row below is built from it, so a leak anywhere is caught.
 */
const otherUser = {
  _id: OTHER_ID,
  username: "sam",
  bio: "hi",
  avatarUrl: null,
  role: "user",
  banned: false,
  emailVerified: true,
  plusUntil: null,
  hideConnections: false,
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  passwordHash: "$2b$10$samshash",
  password: "hunter2",
  email: "sam@example.com",
  refreshToken: "sam-refresh-token",
  tokenHash: "sam-token-hash",
  googleId: "google-sam-id",
};

function makePost() {
  return {
    _id: POST_ID,
    content: "hello commune",
    imageUrl: null,
    priceCents: null,
    premiumContent: null,
    community: null,
    author: otherUser,
    likeCount: 3,
    commentCount: 1,
    editedAt: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
  };
}

/** The like/bookmark/purchase lookups every post response runs; none of them hit a database. */
function mockPostReads() {
  vi.spyOn(Like, "find").mockReturnValue(queryChain([]) as never);
  vi.spyOn(Bookmark, "find").mockReturnValue(queryChain([]) as never);
  vi.spyOn(Purchase, "find").mockReturnValue(queryChain([]) as never);
}

describe("expectNoKeys", () => {
  it("passes a clean body", () => {
    expectNoKeys({ items: [{ id: "1", author: { username: "sam" } }] }, PRIVATE_KEYS);
  });

  it("fails when a private key hides inside a nested object", () => {
    expect(() => {
      expectNoKeys({ author: { email: "sam@example.com" } }, PRIVATE_KEYS);
    }).toThrow();
  });
});

describe("GET /api/users/:username", () => {
  it("never returns another person's private fields", async () => {
    vi.spyOn(User, "findOne").mockReturnValue({
      collation: () => ({ lean: () => Promise.resolve(otherUser) }),
    } as never);
    vi.spyOn(Follow, "countDocuments").mockResolvedValue(0 as never);
    vi.spyOn(Post, "countDocuments").mockResolvedValue(0 as never);
    vi.spyOn(Follow, "exists").mockResolvedValue(null as never);

    const res = await request(app).get("/api/users/sam").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("sam");
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});

describe("GET /api/posts", () => {
  it("never returns private fields from the feed", async () => {
    vi.spyOn(Post, "find").mockReturnValue(queryChain([makePost()]) as never);
    mockPostReads();

    const res = await request(app).get("/api/posts").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].content).toBe("hello commune");
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});

describe("GET /api/posts/:id", () => {
  it("never returns private fields for one post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue({
      populate: () => ({
        populate: () => ({ lean: () => Promise.resolve(makePost()) }),
      }),
    } as never);
    mockPostReads();

    const res = await request(app).get(`/api/posts/${POST_ID.toString()}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(POST_ID.toString());
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});

describe("GET /api/posts/:id/comments", () => {
  it("never returns private fields from comments", async () => {
    const comment = {
      _id: new mongoose.Types.ObjectId(),
      post: POST_ID,
      content: "nice post",
      author: otherUser,
      createdAt: new Date("2026-11-01T11:00:00.000Z"),
    };
    vi.spyOn(Comment, "find").mockReturnValue(queryChain([comment]) as never);

    const res = await request(app).get(`/api/posts/${POST_ID.toString()}/comments`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe("nice post");
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});

describe("GET /api/search/users", () => {
  it("never returns private fields for other people", async () => {
    vi.spyOn(User, "find").mockReturnValue(queryChain([otherUser]) as never);

    const res = await request(app).get("/api/search/users?q=sam").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].username).toBe("sam");
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});

describe("GET /api/search/posts", () => {
  it("never returns private fields from post search", async () => {
    vi.spyOn(Post, "find").mockReturnValue(queryChain([makePost()]) as never);
    mockPostReads();

    const res = await request(app).get("/api/search/posts?q=hello").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].content).toBe("hello commune");
    expectNoKeys(res.body, PRIVATE_KEYS);
  });
});
