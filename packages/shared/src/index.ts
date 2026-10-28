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

/** The ID token ("credential") that Google Identity Services hands to the browser. */
export const googleLoginSchema = z.object({
  credential: z.string().min(100).max(4096),
});

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

/** Largest image the API accepts. Stays under the 4.5 MB request limit of Vercel functions. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Largest photo a person may pick; the app shrinks it before uploading. */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export const communitySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3 to 24 letters, numbers or underscores");

export const createCommunitySchema = z.object({
  slug: communitySlugSchema,
  name: z.string().trim().min(3, "Name needs at least 3 characters").max(40),
  description: z.string().trim().max(280).default(""),
});

export const communityListSchema = z.object({
  q: z.string().trim().max(30).optional(),
  mine: z.enum(["1"]).optional(),
});

/** Paid-post prices are in US cents: $1.00 to $500.00. */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 50000;
export const MAX_PREMIUM_LENGTH = 5000;

/** Free accounts can write 500 characters per post; Commune Plus members 2000. */
export const FREE_POST_LENGTH = 500;
export const PLUS_POST_LENGTH = 2000;

export const createPostSchema = z
  .object({
    // For a paid post this is the free teaser everyone can see. The 500 limit for free
    // accounts is enforced on the server, because it depends on the account's plan.
    content: z.string().trim().max(PLUS_POST_LENGTH),
    imageUrl: uploadUrlSchema.nullish(),
    // Setting a price makes the post paid: premiumContent is shown only after purchase.
    // Slug of a community the author belongs to; the post then appears in that community.
    community: communitySlugSchema.nullish(),
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

/** Search results come in pages of 20, up to 10 pages. */
export const SEARCH_PAGE_SIZE = 20;
export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(50),
  page: z.coerce.number().int().min(1).max(10).default(1),
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

// ---- Direct messages, news and contact ----

export const MESSAGE_MAX_LENGTH = 1000;
export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "Write a message").max(MESSAGE_MAX_LENGTH),
});
export const messagesQuerySchema = z.object({
  /** ISO timestamp of the oldest message already loaded; returns older ones. */
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const NEWS_TOPICS = ["top", "world", "technology", "business", "sport"] as const;
export type NewsTopic = (typeof NEWS_TOPICS)[number];
export const newsQuerySchema = z.object({
  topic: z.enum(NEWS_TOPICS).default("top"),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  message: z.string().trim().min(10, "Write at least 10 characters").max(2000),
  /** Honeypot: real people never fill this in. Bots do, and get a silent success. */
  website: z.string().max(200).optional(),
});

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  other: UserSummaryDTO;
  lastMessage: { text: string; senderId: string; createdAt: string } | null;
  lastMessageAt: string;
  unread: number;
}

export interface MessagePage {
  items: MessageDTO[]; // oldest first
  nextCursor: string | null;
}

export interface NewsItemDTO {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export type ContactInput = z.infer<typeof contactSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
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
  /** Has an active Commune Plus subscription. */
  plus: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthorDTO {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** Has an active Commune Plus subscription. */
  plus: boolean;
}

export interface PostDTO {
  id: string;
  content: string;
  imageUrl: string | null;
  author: AuthorDTO;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** The community this post was made in, if any. */
  community: { slug: string; name: string } | null;
  /** Price in US cents, or null for a free post. */
  priceCents: number | null;
  /** True when the post is paid and the viewer has not unlocked it (and isn't the author). */
  locked: boolean;
  /** The paid content. Always null while `locked`, and for free posts. */
  premiumContent: string | null;
  createdAt: string;
}

export interface UserSummaryDTO {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  plus: boolean;
}

export interface BillingDTO {
  plus: boolean;
  /** When Plus access ends (or the next renewal grace period ends). Null if never subscribed. */
  plusUntil: string | null;
  /** Subscription is cancelled: access continues until plusUntil, then stops. */
  cancelled: boolean;
  status: string | null;
  priceLabel: string;
  /** False when payments aren't set up on this server. */
  available: boolean;
}

export interface InsightsDTO {
  totals: {
    posts: number;
    views: number;
    likes: number;
    comments: number;
    followers: number;
    newFollowers30d: number;
  };
  /** One entry per day for the last 30 days, oldest first. */
  daily: { day: string; views: number }[];
  topPosts: {
    id: string;
    content: string;
    views: number;
    likes: number;
    comments: number;
    createdAt: string;
  }[];
}

export interface CommunityDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  joinedByMe: boolean;
  /** "owner" for the creator, "member" for everyone else who joined, null if not a member. */
  myRole: "owner" | "member" | null;
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

/** Step two of a direct-to-storage upload: tell the API which file the browser uploaded. */
export const completeUploadSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/, "Invalid upload id"),
  format: z.enum(["png", "jpg", "jpeg", "gif", "webp"]),
});

/** "server": send the file to the API. "direct": the browser uploads to cloud storage itself. */
export type UploadTicket =
  | { mode: "server" }
  | {
      mode: "direct";
      uploadUrl: string;
      apiKey: string;
      timestamp: string;
      publicId: string;
      allowedFormats: string;
      signature: string;
    };

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
