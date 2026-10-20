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

/** Path of a file stored by the upload endpoint, e.g. /uploads/3f2a...c9.png */
export const uploadUrlSchema = z
  .string()
  .regex(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/, "Invalid image reference");

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export const createPostSchema = z
  .object({
    content: z.string().trim().max(500),
    imageUrl: uploadUrlSchema.nullish(),
  })
  .refine((v) => v.content.length > 0 || Boolean(v.imageUrl), {
    message: "Write something or attach an image",
    path: ["content"],
  });

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(300),
});

export const updateProfileSchema = z.object({
  bio: z.string().trim().max(160).optional(),
  avatarUrl: uploadUrlSchema.nullable().optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  feed: z.enum(["all", "following"]).default("all"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface PublicUser {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthorDTO {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface PostDTO {
  id: string;
  content: string;
  imageUrl: string | null;
  author: AuthorDTO;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  postId: string;
  content: string;
  author: AuthorDTO;
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

export interface UploadResponse {
  url: string;
}
