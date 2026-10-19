import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { Page, PostDTO } from "@commune/shared";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { notify } from "../services/notificationService.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import {
  toCommentDTO,
  toPostDTO,
  type PopulatedComment,
  type PopulatedPost,
} from "../utils/serializers.js";

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
    .populate("author", "username")
    .lean()) as unknown as PopulatedPost | null;
  if (!post) throw notFound("Post not found");
  return post;
}

/*
 * Send one cursor-paginated page of posts matching `baseFilter`.
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
    .populate("author", "username")
    .lean()) as unknown as PopulatedPost[];

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const liked = await likedSet(
    req.userId!,
    posts.map((p) => p._id),
  );

  const body: Page<PostDTO> = {
    items: posts.map((p) => toPostDTO(p, liked.has(p._id.toString()))),
    nextCursor: hasMore ? (posts[posts.length - 1]?._id.toString() ?? null) : null,
  };
  res.json(body);
}

export async function listPosts(req: Request, res: Response) {
  const { cursor, limit } = (res.locals as { query: { cursor?: string; limit: number } }).query;
  if (cursor && !mongoose.isValidObjectId(cursor)) throw badRequest("Invalid cursor");

  const rows = (await Post.find(cursor ? { _id: { $lt: cursor } } : {})
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username")
    .lean()) as unknown as PopulatedPost[];

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const liked = await likedSet(
    req.userId!,
    posts.map((p) => p._id),
  );

  const body: Page<PostDTO> = {
    items: posts.map((p) => toPostDTO(p, liked.has(p._id.toString()))),
    nextCursor: hasMore ? (posts[posts.length - 1]?._id.toString() ?? null) : null,
  };
  res.json(body);
}

export async function getPost(req: Request, res: Response) {
  const post = await loadPost(param(req, "id"));
  const liked = await likedSet(req.userId!, [post._id]);
  res.json(toPostDTO(post, liked.has(post._id.toString())));
}

export async function createPost(req: Request, res: Response) {
  const created = await Post.create({ author: req.userId, content: req.body.content });
  const post = await loadPost(created._id.toString());
  res.status(201).json(toPostDTO(post, false));
}

export async function deletePost(req: Request, res: Response) {
  const id = param(req, "id");
  const post = await Post.findById(id).select("author");
  if (!post) throw notFound("Post not found");
  if (post.author.toString() !== req.userId) throw forbidden("You can only delete your own posts");

  await Promise.all([
    post.deleteOne(),
    Comment.deleteMany({ post: id }),
    Like.deleteMany({ post: id }),
  ]);
  res.status(204).end();
}

/** Toggles the current user's like. The unique index makes this safe under concurrent clicks. */
export async function toggleLike(req: Request, res: Response) {
  const id = param(req, "id");
  const exists = await Post.exists({ _id: id });
  if (!exists) throw notFound("Post not found");

  const removed = await Like.findOneAndDelete({ post: id, user: req.userId });
  if (removed) {
    await Post.updateOne({ _id: id }, { $inc: { likeCount: -1 } });
  } else {
    try {
      await Like.create({ post: id, user: req.userId });
      await Post.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
    } catch (err) {
      // A concurrent request already created the like; treat as success.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }

  const post = await loadPost(id);
  const liked = await likedSet(req.userId!, [post._id]);
  res.json(toPostDTO(post, liked.has(post._id.toString())));
}

export async function listComments(req: Request, res: Response) {
  const id = param(req, "id");
  const comments = (await Comment.find({ post: id })
    .sort({ _id: 1 })
    .limit(200)
    .populate("author", "username")
    .lean()) as unknown as PopulatedComment[];
  res.json(comments.map(toCommentDTO));
}

export async function addComment(req: Request, res: Response) {
  const id = param(req, "id");
  const exists = await Post.exists({ _id: id });
  if (!exists) throw notFound("Post not found");

  const created = await Comment.create({ post: id, author: req.userId, content: req.body.content });
  await Post.updateOne({ _id: id }, { $inc: { commentCount: 1 } });

  const comment = (await Comment.findById(created._id)
    .populate("author", "username")
    .lean()) as unknown as PopulatedComment;
  res.status(201).json(toCommentDTO(comment));
}
