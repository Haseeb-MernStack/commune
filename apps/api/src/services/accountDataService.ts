import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import type { DeleteAccountInput } from "@commune/shared";
import { AuthToken } from "../models/AuthToken.js";
import { Comment } from "../models/Comment.js";
import { Community } from "../models/Community.js";
import { Conversation } from "../models/Conversation.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Membership } from "../models/Membership.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";
import { Purchase } from "../models/Purchase.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { AppError, badRequest, forbidden, notFound } from "../utils/errors.js";
import { removePost } from "./moderationService.js";
import { disconnectUser } from "./realtime.js";
import { deleteUploadIfUnused } from "./uploadService.js";

/** Most rows of each kind put in one export, so a very active account cannot exhaust memory. */
const EXPORT_LIMIT = 5000;

type Id = mongoose.Types.ObjectId;
interface Row {
  _id: Id;
  createdAt?: Date;
  [key: string]: unknown;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/**
 * Everything we hold about one person, in a form they can read and reuse. Other people's data is
 * limited to usernames (already public). Passwords, tokens and security fields are never included.
 */
export async function buildDataExport(userId: string) {
  const uid = new mongoose.Types.ObjectId(userId);
  const user = (await User.findById(uid)
    .select("username email bio avatarUrl role emailVerified plusUntil createdAt")
    .lean()) as unknown as Row | null;
  if (!user) throw notFound("User not found");

  const [posts, comments, likes, following, memberships, purchases, subscription, conversations] =
    await Promise.all([
      Post.find({ author: uid })
        .sort({ _id: -1 })
        .limit(EXPORT_LIMIT)
        .populate("community", "slug")
        .lean() as unknown as Promise<Row[]>,
      Comment.find({ author: uid })
        .sort({ _id: -1 })
        .limit(EXPORT_LIMIT)
        .lean() as unknown as Promise<Row[]>,
      Like.find({ user: uid }).sort({ _id: -1 }).limit(EXPORT_LIMIT).lean() as unknown as Promise<
        Row[]
      >,
      Follow.find({ follower: uid })
        .limit(EXPORT_LIMIT)
        .populate("following", "username")
        .lean() as unknown as Promise<Row[]>,
      Membership.find({ user: uid })
        .populate("community", "slug name")
        .lean() as unknown as Promise<Row[]>,
      Purchase.find({ user: uid })
        .sort({ _id: -1 })
        .limit(EXPORT_LIMIT)
        .lean() as unknown as Promise<Row[]>,
      Subscription.findOne({ user: uid }).lean() as unknown as Promise<Row | null>,
      Conversation.find({ participants: uid }).select("participants").lean() as unknown as Promise<
        Row[]
      >,
    ]);

  // Messages the person wrote, with the other person's username so the thread makes sense.
  const messages = (await Message.find({ sender: uid })
    .sort({ createdAt: -1 })
    .limit(EXPORT_LIMIT)
    .lean()) as unknown as Row[];
  const peerOf = new Map<string, string>();
  for (const c of conversations) {
    const other = (c.participants as Id[]).find((p) => String(p) !== userId);
    if (other) peerOf.set(String(c._id), String(other));
  }
  const peers = (await User.find({ _id: { $in: [...new Set(peerOf.values())] } })
    .select("username")
    .lean()) as unknown as Row[];
  const nameOf = new Map(peers.map((p) => [String(p._id), String(p.username)]));

  const nested = (value: unknown, key: string) =>
    value && typeof value === "object" ? ((value as Record<string, unknown>)[key] ?? null) : null;

  return {
    exportedAt: new Date().toISOString(),
    note: "Your Commune data. Posts and comments are your own words; other people appear only as usernames.",
    account: {
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl ?? null,
      emailVerified: Boolean(user.emailVerified),
      joinedAt: iso(user.createdAt),
      plusUntil: iso(user.plusUntil as Date | null),
    },
    posts: posts.map((p) => ({
      id: String(p._id),
      content: p.content,
      premiumContent: p.premiumContent ?? null,
      imageUrl: p.imageUrl ?? null,
      priceCents: p.priceCents ?? null,
      community: nested(p.community, "slug"),
      createdAt: iso(p.createdAt),
    })),
    comments: comments.map((c) => ({
      id: String(c._id),
      postId: String(c.post),
      content: c.content,
      createdAt: iso(c.createdAt),
    })),
    likes: likes.map((l) => ({ postId: String(l.post), createdAt: iso(l.createdAt) })),
    following: following.map((f) => nested(f.following, "username")).filter(Boolean),
    communities: memberships.map((m) => ({
      slug: nested(m.community, "slug"),
      name: nested(m.community, "name"),
      role: m.role,
      joinedAt: iso(m.createdAt),
    })),
    purchases: purchases.map((p) => ({
      postId: String(p.post),
      amountCents: p.amountCents,
      currency: p.currency,
      purchasedAt: iso(p.createdAt),
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          cancelled: Boolean(subscription.cancelled),
          renewsAt: iso(subscription.renewsAt as Date | null),
          endsAt: iso(subscription.endsAt as Date | null),
        }
      : null,
    messagesSent: messages.map((m) => ({
      to: nameOf.get(peerOf.get(String(m.conversation)) ?? "") ?? null,
      text: m.text,
      sentAt: iso(m.createdAt),
    })),
  };
}

/** Subscription states that are still billing the person. */
const BILLING_STATES = ["active", "on_trial", "past_due", "paused", "unpaid"];

/**
 * Deletes an account for good: sign-in is removed, personal data is erased and the person's
 * activity is removed from the site. Two things are kept on purpose:
 *  - posts that other people have paid for (without the author's name), so buyers keep what
 *    they bought; and
 *  - payment records, which must be kept for accounting.
 */
export async function deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
  const uid = new mongoose.Types.ObjectId(userId);
  const user = (await User.findById(uid)
    .select("+passwordHash username role googleId avatarUrl")
    .lean()) as unknown as Row | null;
  if (!user) throw notFound("User not found");

  if (user.role === "admin") throw forbidden("Admin accounts cannot be deleted here");
  if (input.confirm.toLowerCase() !== String(user.username).toLowerCase()) {
    throw badRequest("Type your username exactly to confirm");
  }
  // Password accounts must prove it is really them. Accounts that only use Google sign-in have
  // no password they know, and the confirmation above is the check.
  if (input.password !== undefined && input.password !== "") {
    const ok = await bcrypt.compare(input.password, String(user.passwordHash));
    if (!ok) throw forbidden("That password is not correct");
  } else if (!user.googleId) {
    throw badRequest("Enter your password to delete your account");
  }

  const sub = (await Subscription.findOne({ user: uid })
    .select("status cancelled provider")
    .lean()) as unknown as Row | null;
  if (
    sub &&
    sub.provider === "lemonsqueezy" &&
    !sub.cancelled &&
    BILLING_STATES.includes(String(sub.status))
  ) {
    throw new AppError(
      409,
      "Cancel your Commune Plus subscription first (Plus, then Manage billing), then delete your account.",
    );
  }

  // Posts: remove them, except ones other people have paid for.
  const posts = (await Post.find({ author: uid }).select("_id").lean()) as unknown as Row[];
  for (const post of posts) {
    if ((await Purchase.countDocuments({ post: post._id })) === 0)
      await removePost(String(post._id));
  }

  // Comments and likes carry a counter on the post, so the counters are corrected as they go.
  const commentCounts = await Comment.aggregate<{ _id: Id; n: number }>([
    { $match: { author: uid } },
    { $group: { _id: "$post", n: { $sum: 1 } } },
  ]);
  if (commentCounts.length > 0) {
    await Post.bulkWrite(
      commentCounts.map((c) => ({
        updateOne: { filter: { _id: c._id }, update: { $inc: { commentCount: -c.n } } },
      })),
    );
  }
  await Comment.deleteMany({ author: uid });

  const liked = (await Like.find({ user: uid }).select("post").lean()) as unknown as Row[];
  if (liked.length > 0) {
    await Post.updateMany({ _id: { $in: liked.map((l) => l.post) } }, { $inc: { likeCount: -1 } });
  }
  await Like.deleteMany({ user: uid });

  const joined = (await Membership.find({ user: uid })
    .select("community")
    .lean()) as unknown as Row[];
  if (joined.length > 0) {
    await Community.updateMany(
      { _id: { $in: joined.map((m) => m.community) } },
      { $inc: { memberCount: -1 } },
    );
  }
  await Membership.deleteMany({ user: uid });

  await Follow.deleteMany({ $or: [{ follower: uid }, { following: uid }] });
  await Notification.deleteMany({ $or: [{ user: uid }, { actor: uid }] });
  await PostView.deleteMany({ viewer: uid });

  // Private messages: the whole thread goes, so nothing written by this person remains.
  const threads = (await Conversation.find({ participants: uid })
    .select("_id")
    .lean()) as unknown as Row[];
  if (threads.length > 0) {
    const ids = threads.map((t) => t._id);
    await Message.deleteMany({ conversation: { $in: ids } });
    await Conversation.deleteMany({ _id: { $in: ids } });
  }

  await Promise.all([
    PushSubscription.deleteMany({ user: uid }),
    RefreshToken.deleteMany({ user: uid }),
    AuthToken.deleteMany({ user: uid }),
  ]);
  await deleteUploadIfUnused(user.avatarUrl as string | null | undefined);

  // Last: turn the account into an empty shell nobody can sign in to. The unique username and
  // email are replaced, so the person can register again with the same details if they want.
  const shell = crypto.randomBytes(32).toString("hex");
  await User.updateOne(
    { _id: uid },
    {
      $set: {
        username: `deleted_${userId.slice(-8)}`,
        email: `deleted-${userId}@deleted.invalid`,
        bio: "",
        avatarUrl: null,
        banned: true,
        emailVerified: false,
        plusUntil: null,
        pushMessages: false,
        pushSocial: false,
        passwordHash: await bcrypt.hash(shell, 10),
      },
      $unset: { googleId: 1 },
    },
  );
  await disconnectUser(userId);
}
