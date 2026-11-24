import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Block } from "../models/Block.js";
import { Bookmark } from "../models/Bookmark.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { signAccessToken } from "../utils/tokens.js";
import { call, mockUser } from "./helpers.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = "507f1f77bcf86cd799439011";
const token = signAccessToken(ME);

afterEach(() => vi.restoreAllMocks());

/** A query object whose chained methods all return itself and whose lean() gives `value`. */
function chain(value: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["sort", "limit", "select", "populate"]) q[m] = vi.fn(() => q);
  q.lean = () => Promise.resolve(value);
  return q;
}

function post(id = oid()) {
  return {
    _id: id,
    content: "Hello",
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    author: { _id: oid(), username: "sam", avatarUrl: null, plusUntil: null },
  };
}

function setup(p: ReturnType<typeof post> | null, alreadySaved: boolean) {
  mockUser({ role: "user", banned: false });
  vi.spyOn(Post, "findById").mockImplementation((() => chain(p)) as never);
  vi.spyOn(Block, "exists").mockResolvedValue(null as never);
  vi.spyOn(Like, "find").mockImplementation((() => chain([])) as never);
  const remove = vi
    .spyOn(Bookmark, "findOneAndDelete")
    .mockResolvedValue((alreadySaved ? { _id: oid() } : null) as never);
  const create = vi.spyOn(Bookmark, "create").mockResolvedValue({} as never);
  // After the change, the post is read back with the viewer's saved state.
  vi.spyOn(Bookmark, "find").mockImplementation((() =>
    chain(p && !alreadySaved ? [{ post: p._id }] : [])) as never);
  return { remove, create };
}

describe("POST /api/posts/:id/bookmark", () => {
  it("requires a login", async () => {
    expect((await call(app, "post", `/api/posts/${oid()}/bookmark`)).status).toBe(401);
  });

  it("rejects an id that is not valid", async () => {
    mockUser({ role: "user", banned: false });
    expect((await call(app, "post", "/api/posts/nope/bookmark", token)).status).toBe(400);
  });

  it("returns 404 for a post that does not exist", async () => {
    setup(null, false);
    expect((await call(app, "post", `/api/posts/${oid()}/bookmark`, token)).status).toBe(404);
  });

  it("saves a post that was not saved", async () => {
    const p = post();
    const { create } = setup(p, false);
    const res = await call(app, "post", `/api/posts/${p._id}/bookmark`, token);
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledOnce();
    expect(res.body.bookmarkedByMe).toBe(true);
  });

  it("removes the save when the post was already saved", async () => {
    const p = post();
    const { create } = setup(p, true);
    const res = await call(app, "post", `/api/posts/${p._id}/bookmark`, token);
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
    expect(res.body.bookmarkedByMe).toBe(false);
  });
});

describe("GET /api/posts/saved", () => {
  it("requires a login", async () => {
    expect((await call(app, "get", "/api/posts/saved")).status).toBe(401);
  });

  it("is not mistaken for a post id", async () => {
    mockUser({ role: "user", banned: false });
    vi.spyOn(Block, "find").mockImplementation((() => chain([])) as never);
    vi.spyOn(Bookmark, "find").mockImplementation((() => chain([])) as never);
    vi.spyOn(Post, "find").mockImplementation((() => chain([])) as never);
    vi.spyOn(Like, "find").mockImplementation((() => chain([])) as never);
    const res = await call(app, "get", "/api/posts/saved", token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("rejects a cursor that is not a valid id", async () => {
    mockUser({ role: "user", banned: false });
    expect((await call(app, "get", "/api/posts/saved?cursor=nope", token)).status).toBe(400);
  });
});
