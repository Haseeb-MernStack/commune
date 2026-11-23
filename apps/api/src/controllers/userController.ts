import { avatarAllowance, consumeAvatarChange } from "../services/avatarService.js";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { usernameSchema, type FollowListItemDTO } from "@commune/shared";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { notify } from "../services/notificationService.js";
import { deleteUploadIfUnused } from "../services/uploadService.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { isPlusActive } from "../utils/plan.js";
import { toProfileDTO, toPublicUser } from "../utils/serializers.js";
import { sendPostPage } from "./postController.js";

/** Usernames are case-insensitive, so lookups use the same collation as the unique index. */
export async function findByUsername(raw: string | undefined) {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) throw notFound("User not found");
  const user = await User.findOne({ username: parsed.data })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (!user) throw notFound("User not found");
  return user;
}

/**
 * True when the lists are private and this viewer may not open them. The owner and admins (who
 * need them for moderation) always can.
 */
async function connectionsHiddenFrom(
  user: Awaited<ReturnType<typeof findByUsername>>,
  viewerId: string,
): Promise<boolean> {
  if (!user.hideConnections || user._id.toString() === viewerId) return false;
  const viewer = await User.findById(viewerId).select("role").lean();
  return viewer?.role !== "admin";
}

async function buildProfile(user: Awaited<ReturnType<typeof findByUsername>>, viewerId: string) {
  const [followerCount, followingCount, postCount, follows, hidden] = await Promise.all([
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
    Post.countDocuments({ author: user._id }),
    Follow.exists({ follower: viewerId, following: user._id }),
    connectionsHiddenFrom(user, viewerId),
  ]);
  return toProfileDTO(user, { followerCount, followingCount, postCount }, Boolean(follows), hidden);
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.userId).lean();
  if (!user) throw notFound("User not found");
  res.json(toPublicUser(user));
}

/** GET /users/me/avatar-allowance: how many photo changes are left today. */
export async function avatarStatus(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  res.json(await avatarAllowance(req.userId!));
}

/** Updates the fields that were sent: bio and/or avatarUrl (null removes the avatar). */
export async function updateMe(req: Request, res: Response) {
  const existing = await User.findById(req.userId).select("avatarUrl").lean();
  if (!existing) throw notFound("User not found");

  const update: Record<string, unknown> = {};
  if (req.body.bio !== undefined) update.bio = req.body.bio;
  if (req.body.avatarUrl !== undefined) update.avatarUrl = req.body.avatarUrl;

  // Changing or removing the photo is limited per account (the same photo again is not a change).
  const photoChanges =
    req.body.avatarUrl !== undefined && req.body.avatarUrl !== existing.avatarUrl;
  if (photoChanges) {
    try {
      await consumeAvatarChange(req.userId!);
    } catch (err) {
      // The new file was already uploaded; do not leave it behind.
      await deleteUploadIfUnused(req.body.avatarUrl);
      throw err;
    }
  }

  const user = await User.findByIdAndUpdate(req.userId, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (!user) throw notFound("User not found");

  // Remove the old photo from disk once nothing references it.
  if (existing.avatarUrl && existing.avatarUrl !== user.avatarUrl) {
    await deleteUploadIfUnused(existing.avatarUrl);
  }
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

/**
 * A page of the people who follow a user ("followers") or whom they follow ("following"), newest
 * first. Paged by the follow record's id, so the order is stable while people follow and unfollow.
 * Banned accounts are left out. Each person also says whether the viewer follows them and whether
 * they follow the viewer, so the list can show a Follow button and a "Follows you" label.
 */
async function followList(req: Request, res: Response, kind: "followers" | "following") {
  const { cursor, limit } = res.locals.query as { cursor?: string; limit: number };
  if (cursor !== undefined && !mongoose.isValidObjectId(cursor)) throw badRequest("Invalid cursor");

  const target = await findByUsername(req.params.username);
  // Enforced here, not only in the web app: the lists must not be readable by calling the API.
  if (await connectionsHiddenFrom(target, req.userId!)) {
    throw forbidden("This person keeps their followers and following private");
  }
  // For "followers" we list the follower of each record; for "following", the one being followed.
  const shown = kind === "followers" ? "follower" : "following";
  const anchor = kind === "followers" ? "following" : "follower";

  const rows = await Follow.find({
    [anchor]: target._id,
    ...(cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {}),
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select(shown)
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        follower: mongoose.Types.ObjectId;
        following: mongoose.Types.ObjectId;
      }[]
    >();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const ids = page.map((r) => r[shown]);

  const viewer = req.userId!;
  const [users, iFollow, followMe] = await Promise.all([
    User.find({ _id: { $in: ids }, banned: { $ne: true } })
      .select("username bio avatarUrl plusUntil")
      .lean(),
    Follow.find({ follower: viewer, following: { $in: ids } })
      .select("following")
      .lean(),
    Follow.find({ follower: { $in: ids }, following: viewer })
      .select("follower")
      .lean(),
  ]);

  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  const followedByMe = new Set(iFollow.map((f) => f.following.toString()));
  const followsYou = new Set(followMe.map((f) => f.follower.toString()));

  const items: FollowListItemDTO[] = [];
  for (const id of ids) {
    const u = byId.get(id.toString());
    if (!u) continue;
    items.push({
      id: u._id.toString(),
      username: u.username,
      bio: u.bio ?? "",
      avatarUrl: u.avatarUrl ?? null,
      plus: isPlusActive(u.plusUntil),
      followedByMe: followedByMe.has(u._id.toString()),
      followsYou: followsYou.has(u._id.toString()),
    });
  }

  res.json({ items, nextCursor: hasMore ? page[page.length - 1]!._id.toString() : null });
}

export const listFollowers = (req: Request, res: Response) => followList(req, res, "followers");
export const listFollowing = (req: Request, res: Response) => followList(req, res, "following");

/** The signed-in person's own privacy choices. */
export async function getPrivacy(req: Request, res: Response) {
  const user = await User.findById(req.userId).select("hideConnections").lean();
  if (!user) throw notFound("User not found");
  res.json({ hideConnections: Boolean(user.hideConnections) });
}

export async function updatePrivacy(req: Request, res: Response) {
  const { hideConnections } = req.body as { hideConnections: boolean };
  await User.updateOne({ _id: req.userId }, { $set: { hideConnections } });
  res.json({ hideConnections });
}
