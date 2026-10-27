import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { InsightsDTO } from "@commune/shared";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

/** The last 30 UTC days as "YYYY-MM-DD", oldest first. */
export function lastDays(now = Date.now(), count = WINDOW_DAYS): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(now - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** Creator analytics. Plus members only (enforced by requirePlus in the route). */
export async function get(req: Request, res: Response) {
  const author = new mongoose.Types.ObjectId(req.userId);
  const days = lastDays();
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [totals, viewRows, followers, newFollowers, top] = await Promise.all([
    Post.aggregate<{ posts: number; views: number; likes: number; comments: number }>([
      { $match: { author } },
      {
        $group: {
          _id: null,
          posts: { $sum: 1 },
          views: { $sum: "$viewCount" },
          likes: { $sum: "$likeCount" },
          comments: { $sum: "$commentCount" },
        },
      },
    ]),
    PostView.aggregate<{ _id: string; views: number }>([
      { $match: { author, day: { $gte: days[0] } } },
      { $group: { _id: "$day", views: { $sum: 1 } } },
    ]),
    Follow.countDocuments({ following: author }),
    Follow.countDocuments({ following: author, createdAt: { $gte: since } }),
    Post.find({ author })
      .sort({ viewCount: -1, _id: -1 })
      .limit(5)
      .select("content viewCount likeCount commentCount createdAt")
      .lean(),
  ]);

  const byDay = new Map(viewRows.map((r) => [r._id, r.views]));
  const t = totals[0];
  const body: InsightsDTO = {
    totals: {
      posts: t?.posts ?? 0,
      views: t?.views ?? 0,
      likes: t?.likes ?? 0,
      comments: t?.comments ?? 0,
      followers,
      newFollowers30d: newFollowers,
    },
    daily: days.map((day) => ({ day, views: byDay.get(day) ?? 0 })),
    topPosts: top.map((p) => ({
      id: p._id.toString(),
      content: p.content.slice(0, 120),
      views: p.viewCount ?? 0,
      likes: p.likeCount,
      comments: p.commentCount,
      createdAt: p.createdAt.toISOString(),
    })),
  };
  res.json(body);
}
