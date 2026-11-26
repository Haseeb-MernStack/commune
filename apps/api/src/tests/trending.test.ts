import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Post } from "../models/Post.js";
import { TRENDING_WINDOW_MS, sortTrending, trendingScore } from "../utils/trending.js";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const now = new Date("2026-11-26T10:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

describe("trendingScore", () => {
  it("counts a comment twice as much as a like", () => {
    const likes = { likeCount: 2, commentCount: 0, createdAt: now };
    const comments = { likeCount: 0, commentCount: 1, createdAt: now };
    expect(trendingScore(likes, now)).toBe(2);
    expect(trendingScore(comments, now)).toBe(2);
  });

  it("decays with age", () => {
    const fresh = { likeCount: 10, commentCount: 0, createdAt: now };
    const old = { likeCount: 10, commentCount: 0, createdAt: hoursAgo(9) };
    expect(trendingScore(fresh, now)).toBe(10);
    expect(trendingScore(old, now)).toBe(1);
  });

  it("treats a future post as brand new", () => {
    const future = { likeCount: 4, commentCount: 0, createdAt: hoursAgo(-1) };
    expect(trendingScore(future, now)).toBe(4);
  });
});

describe("sortTrending", () => {
  it("orders by score, highest first, without changing the input", () => {
    const low = { likeCount: 1, commentCount: 0, createdAt: hoursAgo(1) };
    const high = { likeCount: 2, commentCount: 2, createdAt: hoursAgo(5) };
    const newest = { likeCount: 0, commentCount: 1, createdAt: now };
    const input = [low, high, newest];
    expect(sortTrending(input, now)).toEqual([newest, high, low]);
    expect(input).toEqual([low, high, newest]);
  });
});

function queryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const step of ["sort", "limit", "populate"]) chain[step] = vi.fn(() => chain);
  chain.lean = () => Promise.resolve(result);
  return chain;
}

describe("GET /api/public/posts/trending", () => {
  const author = { _id: new mongoose.Types.ObjectId(), username: "sam", avatarUrl: null };
  const row = (
    content: string,
    likeCount: number,
    commentCount: number,
    ageHours: number,
    banned = false,
  ) => ({
    _id: new mongoose.Types.ObjectId(),
    content,
    imageUrl: null,
    author: { ...author, banned },
    likeCount,
    commentCount,
    createdAt: hoursAgo(ageHours),
  });

  it("orders the last day's free posts by score and hides suspended authors", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const find = vi
      .spyOn(Post, "find")
      .mockReturnValue(
        queryChain([
          row("Old hit", 10, 0, 9),
          row("Fresh", 0, 1, 0),
          row("Banned hit", 20, 0, 1, true),
        ]) as never,
      );
    const res = await request(app).get("/api/public/posts/trending");
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({
      priceCents: null,
      createdAt: { $gte: new Date(now.getTime() - TRENDING_WINDOW_MS) },
    });
    expect(res.body.items.map((p: { content: string }) => p.content)).toEqual(["Fresh", "Old hit"]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.headers["cache-control"]).toMatch(/max-age=60/);
  });

  it("returns an empty page when nothing trended", async () => {
    vi.spyOn(Post, "find").mockReturnValue(queryChain([]) as never);
    const res = await request(app).get("/api/public/posts/trending");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
