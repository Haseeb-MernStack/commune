import type { Request, Response } from "express";
import type { Page, PostDTO, UserSummaryDTO } from "@commune/shared";
import { SEARCH_PAGE_SIZE } from "@commune/shared";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";
import type { PopulatedPost } from "../utils/serializers.js";
import { presentPosts } from "./postController.js";

interface SearchQuery {
  q: string;
  page: number;
}

const readQuery = (res: Response) => (res.locals as { query: SearchQuery }).query;

/** Fetches one extra row to learn whether another page exists. */
function paginate<T>(rows: T[], page: number) {
  const hasMore = rows.length > SEARCH_PAGE_SIZE;
  return {
    items: hasMore ? rows.slice(0, SEARCH_PAGE_SIZE) : rows,
    nextCursor: hasMore ? String(page + 1) : null,
  };
}

/** People whose username starts with the text (case-insensitive). Suspended accounts are hidden. */
export async function users(_req: Request, res: Response) {
  const { q, page } = readQuery(res);
  const rows = await User.find({
    username: { $regex: `^${escapeRegex(q)}`, $options: "i" },
    banned: { $ne: true },
  })
    .sort({ username: 1 })
    .skip((page - 1) * SEARCH_PAGE_SIZE)
    .limit(SEARCH_PAGE_SIZE + 1)
    .select("username bio avatarUrl")
    .lean();

  const { items, nextCursor } = paginate(rows, page);
  const body: Page<UserSummaryDTO> = {
    items: items.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      bio: u.bio ?? "",
      avatarUrl: u.avatarUrl ?? null,
    })),
    nextCursor,
  };
  res.json(body);
}

/** Posts matching the words, best match first. Only free text is searched, never paid content. */
export async function posts(req: Request, res: Response) {
  const { q, page } = readQuery(res);
  const rows = (await Post.find({ $text: { $search: q } }, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .skip((page - 1) * SEARCH_PAGE_SIZE)
    .limit(SEARCH_PAGE_SIZE + 1)
    .populate("author", "username avatarUrl")
    .populate("community", "slug name")
    .lean()) as unknown as PopulatedPost[];

  const { items, nextCursor } = paginate(rows, page);
  const body: Page<PostDTO> = { items: await presentPosts(req.userId!, items), nextCursor };
  res.json(body);
}
