import mongoose from "mongoose";
import type { Request, Response } from "express";
import { FREE_POST_LENGTH } from "@commune/shared";
import type { Page, PostDTO } from "@commune/shared";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Community } from "../models/Community.js";
import { Like } from "../models/Like.js";
import { Membership } from "../models/Membership.js";
import { Post } from "../models/Post.js";
import { notify } from "../services/notificationService.js";
import { unlockedPostIds } from "../services/purchaseService.js";
import { removePost } from "../services/moderationService.js";
import { PostView } from "../models/PostView.js";
import { User } from "../models/User.js";
import { isPlusActive } from "../utils/plan.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import {
  toCommentDTO,
  toPostDTO,
  type PopulatedComment,
  type PopulatedPost,
} from "../utils/serializers.js";

const AUTHOR_FIELDS = "username avatarUrl plusUntil";
const COMMUNITY_FIELDS = "slug name";

const param = (req: Request, name: string): string => {
  const value = req.params[name];
  if (!value || !mongoose.isValidObjectId(value)) throw badRequest("Invalid id");
  return value;
};

async function likedSet(userId: string, postIds: mongoose.Types.ObjectId[]) {
  const likes = await Like.find({ user: userId, post: { $in: postIds } })
    .select("post")
    .lean();
  return new Set(likes.map((l) => l.post.toString()));
}

async function loadPost(id: string): Promise<PopulatedPost> {
  const post = (await Post.findById(id)
    .populate("author", AUTHOR_FIELDS)
    .populate("community", COMMUNITY_FIELDS)
    .lean()) as unknown as PopulatedPost | null;
  if (!post) throw notFound("Post not found");
  return post;
}

/** Builds the DTO for a single post as seen by this viewer (paid content only if unlocked). */
async function withViewer(userId: string, post: PopulatedPost, liked: Set<string>) {
  const unlocked = await unlockedPostIds(userId, [post]);
  const key = post._id.toString();
  return toPostDTO(post, liked.has(key), unlocked.has(key) || post.priceCents == null);
}

/** Turns loaded posts into DTOs for one viewer (likes and paid-content access included). */
export async function presentPosts(userId: string, posts: PopulatedPost[]): Promise<PostDTO[]> {
  const [liked, unlocked] = await Promise.all([
    likedSet(
      userId,
      posts.map((p) => p._id),
    ),
    unlockedPostIds(userId, posts),
  ]);
  return posts.map((p) => {
    const key = p._id.toString();
    return toPostDTO(p, liked.has(key), unlocked.has(key) || p.priceCents == null);
  });
}

/**
 * Sends one cursor-paginated page of posts matching `baseFilter`.
 * Expects validated pagination params in res.locals.query (see the validate middleware).
 */
export async function sendPostPage(
  req: Request,
  res: Response,
  baseFilter: Record<string, unknown>,
) {
  const { cursor, limit } = (res.locals as { query: { cursor?: string; limit: number } }).query;
  if (cursor && !mongoose.isValidObjectId(cursor)) throw badRequest("Invalid cursor");

  const filter = cursor ? { ...baseFilter, _id: { $lt: cursor } } : baseFilter;
  const rows = (await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_FIELDS)
    .populate("community", COMMUNITY_FIELDS)
    .lean()) as unknown as PopulatedPost[];

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const liked = await likedSet(
    req.userId!,
    posts.map((p) => p._id),
  );

  const unlocked = await unlockedPostIds(req.userId!, posts);
  const body: Page<PostDTO> = {
    items: posts.map((p) => {
      const key = p._id.toString();
      return toPostDTO(p, liked.has(key), unlocked.has(key) || p.priceCents == null);
    }),
    nextCursor: hasMore ? (posts[posts.length - 1]?._id.toString() ?? null) : null,
  };
  res.json(body);
}

export async function listPosts(req: Request, res: Response) {
  const { feed } = (res.locals as { query: { feed: "all" | "following" } }).query;

  const baseFilter: Record<string, unknown> = {};
  if (feed === "following") {
    // Posts from people I follow, plus my own.
    const follows = await Follow.find({ follower: req.userId }).select("following").lean();
    baseFilter.author = { $in: [...follows.map((f) => f.following), req.userId] };
  }
  await sendPostPage(req, res, baseFilter);
}

export async function getPost(req: Request, res: Response) {
  const post = await loadPost(param(req, "id"));
  const liked = await likedSet(req.userId!, [post._id]);
  res.json(await withViewer(req.userId!, post, liked));
}

export async function createPost(req: Request, res: Response) {
  // Long posts are a Commune Plus feature.
  if ((req.body.content as string).length > FREE_POST_LENGTH) {
    const author = await User.findById(req.userId).select("plusUntil").lean();
    if (!isPlusActive(author?.plusUntil)) {
      throw forbidden(`Posts over ${FREE_POST_LENGTH} characters need Commune Plus`);
    }
  }
  let communityId: string | null = null;
  if (req.body.community) {
    const community = await Community.findOne({ slug: req.body.community }).select("_id").lean();
    if (!community) throw notFound("Community not found");
    // Only members can post in a community.
    if (!(await Membership.exists({ user: req.userId, community: community._id }))) {
      throw forbidden("Join this community to post in it");
    }
    communityId = community._id.toString();
  }
  const created = await Post.create({
    author: req.userId,
    community: communityId,
    content: req.body.content,
    imageUrl: req.body.imageUrl ?? null,
    priceCents: req.body.priceCents ?? null,
    premiumContent: req.body.priceCents != null ? req.body.premiumContent : null,
  });
  const post = await loadPost(created._id.toString());
  // The author can always read their own paid content.
  res.status(201).json(toPostDTO(post, false, true));
}

export async function deletePost(req: Request, res: Response) {
  const id = param(req, "id");
  const post = await Post.findById(id).select("author community").lean();
  if (!post) throw notFound("Post not found");
  // Authors can delete their own posts; admins can remove anyone's; so can the owner of the
  // community the post was made in.
  const allowed =
    post.author.toString() === req.userId ||
    req.userRole === "admin" ||
    (post.community != null &&
      Boolean(await Membership.exists({ user: req.userId, community: post.community, role: "owner" })));
  if (!allowed) throw forbidden("You can only delete your own posts");

  await removePost(id, req.userId);
  res.status(204).end();
}

/** Toggles the current user's like. The unique index makes this safe under concurrent clicks. */
export async function toggleLike(req: Request, res: Response) {
  const id = param(req, "id");
  const target = await Post.findById(id).select("author").lean();
  if (!target) throw notFound("Post not found");

  const removed = await Like.findOneAndDelete({ post: id, user: req.userId });
  if (removed) {
    await Post.updateOne({ _id: id }, { $inc: { likeCount: -1 } });
  } else {
    try {
      await Like.create({ post: id, user: req.userId });
      await Post.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
      await notify({ user: target.author, actor: req.userId!, type: "like", post: id });
    } catch (err) {
      // A concurrent request already created the like; treat as success.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }

  const post = await loadPost(id);
  const liked = await likedSet(req.userId!, [post._id]);
  res.json(await withViewer(req.userId!, post, liked));
}

export async function listComments(req: Request, res: Response) {
  const id = param(req, "id");
  const comments = (await Comment.find({ post: id })
    .sort({ _id: 1 })
    .limit(200)
    .populate("author", AUTHOR_FIELDS)
    .lean()) as unknown as PopulatedComment[];
  res.json(comments.map(toCommentDTO));
}

export async function addComment(req: Request, res: Response) {
  const id = param(req, "id");
  const target = await Post.findById(id).select("author").lean();
  if (!target) throw notFound("Post not found");

  const created = await Comment.create({ post: id, author: req.userId, content: req.body.content });
  await Post.updateOne({ _id: id }, { $inc: { commentCount: 1 } });
  await notify({ user: target.author, actor: req.userId!, type: "comment", post: id });

  const comment = (await Comment.findById(created._id)
    .populate("author", AUTHOR_FIELDS)
    .lean()) as unknown as PopulatedComment;
  res.status(201).json(toCommentDTO(comment));
}

/**
 * Counts a view of a post: once per viewer per day, never the author's own. Called by the web
 * app when a post page is opened; powers the Insights dashboard.
 */
export async function trackView(req: Request, res: Response) {
  const id = param(req, "id");
  const post = await Post.findById(id).select("author").lean();
  if (!post) throw notFound("Post not found");
  if (post.author.toString() !== req.userId) {
    const day = new Date().toISOString().slice(0, 10);
    const result = await PostView.updateOne(
      { post: id, viewer: req.userId, day },
      { $setOnInsert: { author: post.author, createdAt: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount > 0) await Post.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
  }
  res.status(204).end();
}
