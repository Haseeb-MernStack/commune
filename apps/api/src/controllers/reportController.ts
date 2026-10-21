import type { Request, Response } from "express";
import { Post } from "../models/Post.js";
import { Report } from "../models/Report.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { idParam } from "../utils/params.js";

export async function createReport(req: Request, res: Response) {
  const id = idParam(req, "id");
  const post = await Post.findById(id).select("author").lean();
  if (!post) throw notFound("Post not found");
  if (post.author.toString() === req.userId) throw badRequest("You can't report your own post");

  try {
    await Report.create({
      reporter: req.userId,
      post: id,
      reason: req.body.reason,
      details: req.body.details ?? "",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw conflict("You already reported this post");
    }
    throw err;
  }
  res.status(201).json({ ok: true });
}
