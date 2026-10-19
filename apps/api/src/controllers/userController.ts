import type { Request, Response } from "express";
import { usernameSchema } from "@commune/shared";
import { Follow } from "../models/Follow";
import { User } from "../models/User.js";
import { notify } from "../services/notificationService.js";
import { badRequest, notFound } from "../utils/errors.js";
import { toProfileDTO, toPublicUser } from "../utils/serializers.js";
import { sendPostPage } from "./postController.js";

async function findByUsername(raw: string | undefined) {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) throw notFound("User not found");
  const user = await User.findOne({ username: parsed.data })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (!user) throw notFound("User not found");
  return user;
}

async function buildProfile(user: Awaited<ReturnType<typeof findByUsername>>, viewerId: string) {
  const [followerCount, followingCount, follows] = await Promise.all([
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
    Follow.exists({ follower: viewerId, following: user._id }),
  ]);
  return toProfileDTO(user, { followerCount, followingCount }, Boolean(follows));
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.userId).lean();
  if (!user) throw notFound("User not found");
  res.json(toPublicUser(user));
}

export async function updateMe(req: Request, res: Response) {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { bio: req.body.bio },
    { new: true, runValidators: true },
  ).lean();
  if (!user) throw notFound("User not found");
  res.json(toPublicUser(user));
}

export async function getProfile(req: Request, res: Response) {
  const user = await findByUsername(req.params.username);
  res.json(await buildProfile(user, req.userId!));
}

export async function userPosts(req: Request, res: Response) {
  const user = await findByUsername(req.params.username);
  await sendPostPage(req, res, { author: user._id });
}

/** Toggles following. Returns the updated profile so the UI can refresh counts in one step. */
export async function toggleFollow(req: Request, res: Response) {
  const user = await findByUsername(req.params.username);
  if (user._id.toString() === req.userId) throw badRequest("You can't follow yourself");

  const removed = await Follow.findOneAndDelete({ follower: req.userId, following: user._id });
  if (!removed) {
    try {
      await Follow.create({ follower: req.userId, following: user._id });
      await notify({ user: user._id, actor: req.userId!, type: "follow" });
    } catch (err) {
      // A concurrent request already created the follow; treat as success.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  res.json(await buildProfile(user, req.userId!));
}
