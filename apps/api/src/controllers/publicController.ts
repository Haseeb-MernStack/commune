import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { Page, PostDTO } from "@commune/shared";
import { Post } from "../models/Post.js";
import { badRequest } from "../utils/errors.js";
import { toPostDTO, type PopulatedPost } from "../utils/serializers.js";
import { TRENDING_MAX_CANDIDATES, TRENDING_WINDOW_MS, sortTrending } from "../utils/trending.js";

/**
 * Latest posts for logged-out visitors. Paid posts are excluded entirely (not even teasers),
 * and nothing viewer-specific (likes) is included, so the response is the same for everyone.
 */
export async function listPosts(_req: Request, res: Response) {
  const { cursor, limit } = (res.locals as { query: { cursor?: string; limit: number } }).query;
  if (cursor && !mongoose.isValidObjectId(cursor)) throw badRequest("Invalid cursor");

  const filter = cursor ? { priceCents: null, _id: { $lt: cursor } } : { priceCents: null };
  const rows = (await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username avatarUrl plusUntil")
    .populate("community", "slug name")
    .lean()) as unknown as PopulatedPost[];

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const body: Page<PostDTO> = {
    items: posts.map((p) => toPostDTO(p, false, true)),
    nextCursor: hasMore ? (posts[posts.length - 1]?._id.toString() ?? null) : null,
  };
  // Everyone gets the same answer, so the CDN may serve it for a minute and refresh in the background.
  res.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
  res.json(body);
}

/**
 * Trending posts from the last 24 hours, highest score first. Paid posts are excluded
 * entirely, as are posts from suspended accounts. The response is the same for everyone,
 * so the CDN may serve it for a minute.
 */
export async function listTrendingPosts(_req: Request, res: Response) {
  const { limit } = (res.locals as { query: { limit: number } }).query;
  const now = new Date();
  const since = new Date(now.getTime() - TRENDING_WINDOW_MS);
  const rows = (await Post.find({ priceCents: null, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(TRENDING_MAX_CANDIDATES)
    .populate("author", "username avatarUrl plusUntil banned")
    .populate("community", "slug name")
    .lean()) as unknown as (PopulatedPost & { author?: { banned?: boolean } })[];
  const visible = rows.filter((p) => !p.author?.banned);
  const posts = sortTrending(visible, now).slice(0, limit);
  const body: Page<PostDTO> = {
    items: posts.map((p) => toPostDTO(p, false, true)),
    nextCursor: null,
  };
  // Everyone gets the same answer, so the CDN may serve it for a minute.
  res.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
  res.json(body);
}
