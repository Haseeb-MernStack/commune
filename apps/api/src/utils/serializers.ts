import type { Types } from "mongoose";
import type {
  CommentDTO,
  NotificationDTO,
  NotificationType,
  PostDTO,
  ProfileDTO,
  PublicUser,
  ReportDTO,
  ReportReason,
  ReportStatus,
} from "@commune/shared";

interface UserLike {
  _id: Types.ObjectId;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  banned?: boolean | null;
  emailVerified?: boolean | null;
  createdAt: Date;
}

interface PopulatedAuthor {
  _id: Types.ObjectId;
  username: string;
  avatarUrl?: string | null;
}

export interface PopulatedPost {
  _id: Types.ObjectId;
  content: string;
  imageUrl?: string | null;
  author: PopulatedAuthor;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface PopulatedComment {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  content: string;
  author: PopulatedAuthor;
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

export interface PopulatedReport {
  _id: Types.ObjectId;
  reason: ReportReason;
  details?: string | null;
  status: ReportStatus;
  reporter: { _id: Types.ObjectId; username: string };
  post: {
    _id: Types.ObjectId;
    content: string;
    imageUrl?: string | null;
    author: PopulatedAuthor;
  } | null;
  createdAt: Date;
  resolvedAt?: Date | null;
}

const toAuthor = (a: PopulatedAuthor) => ({
  id: a._id.toString(),
  username: a.username,
  avatarUrl: a.avatarUrl ?? null,
});

export function toPublicUser(u: UserLike): PublicUser {
  return {
    id: u._id.toString(),
    username: u.username,
    bio: u.bio ?? "",
    avatarUrl: u.avatarUrl ?? null,
    role: u.role === "admin" ? "admin" : "user",
    emailVerified: Boolean(u.emailVerified),
    createdAt: u.createdAt.toISOString(),
  };
}

export function toProfileDTO(
  u: UserLike,
  counts: { followerCount: number; followingCount: number },
  followedByMe: boolean,
): ProfileDTO {
  return { ...toPublicUser(u), ...counts, followedByMe, banned: Boolean(u.banned) };
}

export function toPostDTO(p: PopulatedPost, likedByMe: boolean): PostDTO {
  return {
    id: p._id.toString(),
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    author: toAuthor(p.author),
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
    author: toAuthor(c.author),
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

export function toReportDTO(r: PopulatedReport): ReportDTO {
  return {
    id: r._id.toString(),
    reason: r.reason,
    details: r.details ?? "",
    status: r.status,
    reporter: { id: r.reporter._id.toString(), username: r.reporter.username },
    post: r.post
      ? {
          id: r.post._id.toString(),
          content: r.post.content,
          imageUrl: r.post.imageUrl ?? null,
          author: toAuthor(r.post.author),
        }
      : null,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}
