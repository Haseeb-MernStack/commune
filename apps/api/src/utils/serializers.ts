import type { Types } from "mongoose";
import type {
  CommentDTO,
  NotificationDTO,
  NotificationType,
  PostDTO,
  ProfileDTO,
  PublicUser,
} from "@commune/shared";

interface UserLike {
  _id: Types.ObjectId;
  username: string;
  bio?: string | null;
  createdAt: Date;
}

export interface PopulatedPost {
  _id: Types.ObjectId;
  content: string;
  author: { _id: Types.ObjectId; username: string };
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface PopulatedComment {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  content: string;
  author: { _id: Types.ObjectId; username: string };
  createdAt: Date;
}

export interface PopulatedNotification {
  _id: Types.ObjectId;
  type: NotificationType;
  actor: { _id: Types.ObjectId; username: string };
  post: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}

export function toPublicUser(u: UserLike): PublicUser {
  return {
    id: u._id.toString(),
    username: u.username,
    bio: u.bio ?? "",
    createdAt: u.createdAt.toISOString(),
  };
}

export function toProfileDTO(
  u: UserLike,
  counts: { followerCount: number; followingCount: number },
  followedByMe: boolean,
): ProfileDTO {
  return { ...toPublicUser(u), ...counts, followedByMe };
}

export function toPostDTO(p: PopulatedPost, likedByMe: boolean): PostDTO {
  return {
    id: p._id.toString(),
    content: p.content,
    author: { id: p.author._id.toString(), username: p.author.username },
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toCommentDTO(c: PopulatedComment): CommentDTO {
  return {
    id: c._id.toString(),
    postId: c.post.toString(),
    content: c.content,
    author: { id: c.author._id.toString(), username: c.author.username },
    createdAt: c.createdAt.toISOString(),
  };
}

export function toNotificationDTO(n: PopulatedNotification): NotificationDTO {
  return {
    id: n._id.toString(),
    type: n.type,
    actor: { id: n.actor._id.toString(), username: n.actor.username },
    postId: n.post ? n.post.toString() : null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}
