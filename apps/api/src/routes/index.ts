import { Router } from "express";
import {
  banUserSchema,
  createCommentSchema,
  createPostSchema,
  createReportSchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  paginationSchema,
  registerSchema,
  reportQuerySchema,
  resetPasswordSchema,
  resolveReportSchema,
  searchQuerySchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@commune/shared";
import * as account from "../controllers/accountController.js";
import * as admin from "../controllers/adminController.js";
import * as auth from "../controllers/authController.js";
import * as payments from "../controllers/paymentController.js";
import * as notifications from "../controllers/notificationController.js";
import * as posts from "../controllers/postController.js";
import * as reports from "../controllers/reportController.js";
import * as publicApi from "../controllers/publicController.js";
import * as search from "../controllers/searchController.js";
import * as uploads from "../controllers/uploadController.js";
import * as users from "../controllers/userController.js";
import { requireActive, requireAdmin, requireAuth } from "../middleware/auth.js";
import { authLimiter, checkoutLimiter, emailLimiter, reportLimiter, publicLimiter, searchLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { parseImageUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

export const router = Router();

/**
 * Middleware order on write routes:  requireAuth -> (limiter) -> validate -> requireActive.
 * Validation runs before the database lookup in requireActive so malformed requests are
 * rejected cheaply. Reads only need requireAuth. Admin routes check the role first.
 */
const adminOnly = [requireAuth, requireActive, requireAdmin];

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Auth
router.post("/auth/register", authLimiter, validate(registerSchema), asyncHandler(auth.register));
router.post("/auth/login", authLimiter, validate(loginSchema), asyncHandler(auth.login));
router.post("/auth/google", authLimiter, validate(googleLoginSchema), asyncHandler(auth.google));
router.post("/auth/refresh", authLimiter, asyncHandler(auth.refresh));
router.post("/auth/logout", asyncHandler(auth.logout));

// Email verification and password reset
router.post(
  "/auth/forgot-password",
  emailLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(account.forgotPassword),
);
router.post(
  "/auth/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(account.resetPassword),
);
router.post(
  "/auth/verify-email",
  authLimiter,
  validate(verifyEmailSchema),
  asyncHandler(account.verifyEmail),
);
router.post(
  // No requireActive here: with REQUIRE_VERIFIED_EMAIL on, unverified users must still be able
  // to ask for a new link. The controller rejects suspended accounts itself.
  "/auth/resend-verification",
  requireAuth,
  emailLimiter,
  asyncHandler(account.resendVerification),
);

// Public, read-only (no login): powers the Explore page that search engines and ad
// reviewers can see. Only free posts are ever returned.
router.get(
  "/public/posts",
  publicLimiter,
  validate(paginationSchema, "query"),
  asyncHandler(publicApi.listPosts),
);

// Uploads (auth and rate limit run before the file is parsed)
router.post(
  "/uploads",
  requireAuth,
  uploadLimiter,
  parseImageUpload,
  requireActive,
  asyncHandler(uploads.upload),
);

// Users. "/users/me" must be declared before "/users/:username".
router.get("/users/me", requireAuth, asyncHandler(users.me));
router.patch(
  "/users/me",
  requireAuth,
  validate(updateProfileSchema),
  requireActive,
  asyncHandler(users.updateMe),
);
router.get("/users/me/earnings", requireAuth, asyncHandler(payments.earnings));
router.get("/users/:username", requireAuth, asyncHandler(users.getProfile));
router.get(
  "/users/:username/posts",
  requireAuth,
  validate(paginationSchema, "query"),
  asyncHandler(users.userPosts),
);
router.post("/users/:username/follow", requireAuth, requireActive, asyncHandler(users.toggleFollow));

// Notifications
router.get("/notifications", requireAuth, asyncHandler(notifications.list));
router.get("/notifications/unread-count", requireAuth, asyncHandler(notifications.unreadCount));
router.post("/notifications/read", requireAuth, asyncHandler(notifications.markAllRead));

// Search
router.get(
  "/search/users",
  requireAuth,
  searchLimiter,
  validate(searchQuerySchema, "query"),
  asyncHandler(search.users),
);
router.get(
  "/search/posts",
  requireAuth,
  searchLimiter,
  validate(searchQuerySchema, "query"),
  asyncHandler(search.posts),
);

// Posts
router.get("/posts", requireAuth, validate(paginationSchema, "query"), asyncHandler(posts.listPosts));
router.post(
  "/posts",
  requireAuth,
  validate(createPostSchema),
  requireActive,
  asyncHandler(posts.createPost),
);
router.get("/posts/:id", requireAuth, asyncHandler(posts.getPost));
router.delete("/posts/:id", requireAuth, requireActive, asyncHandler(posts.deletePost));
router.post("/posts/:id/like", requireAuth, requireActive, asyncHandler(posts.toggleLike));
router.post(
  "/posts/:id/checkout",
  requireAuth,
  checkoutLimiter,
  requireActive,
  asyncHandler(payments.checkout),
);
router.get("/posts/:id/comments", requireAuth, asyncHandler(posts.listComments));
router.post(
  "/posts/:id/comments",
  requireAuth,
  validate(createCommentSchema),
  requireActive,
  asyncHandler(posts.addComment),
);
router.post(
  "/posts/:id/report",
  requireAuth,
  reportLimiter,
  validate(createReportSchema),
  requireActive,
  asyncHandler(reports.createReport),
);

// Admin / moderation
router.get(
  "/admin/reports",
  ...adminOnly,
  validate(reportQuerySchema, "query"),
  asyncHandler(admin.listReports),
);
router.post("/admin/reports/:id/dismiss", ...adminOnly, asyncHandler(admin.dismissReport));
router.post(
  "/admin/reports/:id/resolve",
  ...adminOnly,
  validate(resolveReportSchema),
  asyncHandler(admin.resolveReport),
);
router.post(
  "/admin/users/:username/ban",
  ...adminOnly,
  validate(banUserSchema),
  asyncHandler(admin.banUserByUsername),
);
router.post("/admin/users/:username/unban", ...adminOnly, asyncHandler(admin.unbanUserByUsername));
