import type { Types } from "mongoose";
import type { NotificationType } from "@commune/shared";
import { logger } from "../config/logger.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { pushConfigured, pushToUser } from "./pushService.js";
import { emitToUsers } from "./realtime.js";

interface NotifyInput {
  /** Recipient. */
  user: Types.ObjectId | string;
  /** The user who did the thing (id as string). */
  actor: string;
  type: NotificationType;
  post?: Types.ObjectId | string;
}

/**
 * Creates a notification. Never throws: a failed notification must not break the
 * action (like, comment, follow) that triggered it.
 *
 * Likes and follows are upserted so repeated like/unlike or follow/unfollow does not
 * spam the recipient; each comment creates its own notification.
 */
export async function notify({ user, actor, type, post }: NotifyInput): Promise<void> {
  if (user.toString() === actor) return;
  try {
    const key = { user, actor, type, post: post ?? null };
    if (type === "comment") {
      await Notification.create({ ...key, read: false });
    } else {
      await Notification.updateOne(
        key,
        { $set: { read: false, createdAt: new Date() } },
        { upsert: true },
      );
    }
    // A hint only (no content): the client refetches its notifications.
    await emitToUsers([user], "notification:new");
    if (pushConfigured()) {
      const actorUser = (await User.findById(actor).select("username").lean()) as {
        username?: string;
      } | null;
      const name = `@${actorUser?.username ?? "Someone"}`;
      const text = {
        like: "liked your post",
        comment: "commented on your post",
        follow: "started following you",
      }[type];
      await pushToUser(user.toString(), "social", {
        title: "Commune",
        body: `${name} ${text}`,
        url: post ? `/posts/${post.toString()}` : `/u/${actorUser?.username ?? ""}`,
        tag: `social-${type}-${post?.toString() ?? actor}`,
      });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to create notification");
  }
}
