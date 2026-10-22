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

const passwordField = z.string().min(8).max(128);
// Reset and verification tokens are 48 random bytes, hex encoded.
const tokenField = z.string().regex(/^[a-f0-9]{96}$/, "This link is invalid");

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: tokenField,
  password: passwordField,
});

export const verifyEmailSchema = z.object({
  token: tokenField,
});

/** Path of a file stored by the upload endpoint, e.g. /uploads/3f2a...c9.png */
export const uploadUrlSchema = z
  .string()
  .regex(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/, "Invalid image reference");

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** Paid-post prices are in US cents: $1.00 to $500.00. */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 50000;
export const MAX_PREMIUM_LENGTH = 5000;

export const createPostSchema = z
  .object({
    // For a paid post this is the free teaser everyone can see.
    content: z.string().trim().max(500),
    imageUrl: uploadUrlSchema.nullish(),
    // Setting a price makes the post paid: premiumContent is shown only after purchase.
    priceCents: z.number().int().min(MIN_PRICE_CENTS).max(MAX_PRICE_CENTS).nullish(),
    premiumContent: z.string().trim().max(MAX_PREMIUM_LENGTH).nullish(),
  })
  .refine((v) => v.content.length > 0 || Boolean(v.imageUrl), {
    message: "Write something or attach an image",
    path: ["content"],
  })
  .refine((v) => v.priceCents == null || (v.premiumContent?.length ?? 0) > 0, {
    message: "Add the content people will pay to unlock",
    path: ["premiumContent"],
  })
  .refine((v) => v.priceCents != null || !v.premiumContent, {
    message: "Set a price to publish paid content",
    path: ["priceCents"],
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

// ---- Moderation ----

export const REPORT_REASONS = ["spam", "harassment", "hate", "violence", "other"] as const;
export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;

export const createReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(300).optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(["remove_post", "remove_post_and_ban"]),
});

export const banUserSchema = z.object({
  removePosts: z.boolean().default(false),
});

export const reportQuerySchema = paginationSchema.omit({ feed: true }).extend({
  status: z.enum(REPORT_STATUSES).default("open"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type Role = "user" | "admin";

export interface PublicUser {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  emailVerified: boolean;
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
  /** Price in US cents, or null for a free post. */
  priceCents: number | null;
  /** True when the post is paid and the viewer has not unlocked it (and isn't the author). */
  locked: boolean;
  /** The paid content. Always null while `locked`, and for free posts. */
  premiumContent: string | null;
  createdAt: string;
}

export interface CheckoutResponse {
  url: string;
}

export interface EarningsDTO {
  currency: string;
  sales: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
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
  banned: boolean;
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

export interface ReportDTO {
  id: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reporter: Pick<PublicUser, "id" | "username">;
  /** null when the reported post has since been deleted */
  post: { id: string; content: string; imageUrl: string | null; author: AuthorDTO } | null;
  createdAt: string;
  resolvedAt: string | null;
}
