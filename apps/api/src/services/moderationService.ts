import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { deleteUploadIfUnused } from "./uploadService.js";

/**
 * Deletes a post and everything attached to it (comments, likes, notifications, image).
 * Open reports about the post are marked resolved so they leave the admin queue.
 * Used both when authors delete their own posts and when admins remove posts.
 */
export async function removePost(postId: string, resolvedBy?: string): Promise<void> {
  const post = await Post.findById(postId).select("imageUrl");
  if (!post) return;

  await Promise.all([
    post.deleteOne(),
    Comment.deleteMany({ post: postId }),
    Like.deleteMany({ post: postId }),
    Notification.deleteMany({ post: postId }),
    Report.updateMany(
      { post: postId, status: "open" },
      { $set: { status: "resolved", resolvedAt: new Date(), resolvedBy: resolvedBy ?? null } },
    ),
  ]);
  await deleteUploadIfUnused(post.imageUrl);
}

/**
 * Suspends an account. Deleting their refresh tokens ends every session: they cannot get a new
 * access token, and requireActive blocks any write with the one they already hold.
 */
export async function banUser(
  userId: string,
  options: { removePosts: boolean; adminId?: string },
): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { banned: true } });
  await RefreshToken.deleteMany({ user: userId });

  if (options.removePosts) {
    const posts = await Post.find({ author: userId }).select("_id").lean();
    for (const post of posts) {
      await removePost(post._id.toString(), options.adminId);
    }
  }
}

export async function unbanUser(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { banned: false } });
}
