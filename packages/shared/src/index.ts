import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only");

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const createPostSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(300),
});

export const updateProfileSchema = z.object({
  bio: z.string().trim().max(160),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  feed: z.enum(["all","following"]).default("all"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PublicUser {
  id: string;
  username: string;
  bio: string;
  createdAt: string;
}

export interface PostDTO {
  id: string;
  content: string;
  author: Pick<PublicUser, "id" | "username">;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  postId: string;
  content: string;
  author: Pick<PublicUser, "id" | "username">;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}


export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface ProfileDTO extends PublicUser {
  followerCount: number;
  followingCount: number;
  followedByMe: boolean;
}

export type NotificationType = "like" | "comment" | "follow";

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actor: Pick<PublicUser, "id" | "username">;
  postId: string | null;
  read: boolean;
  createdAt: string;
}