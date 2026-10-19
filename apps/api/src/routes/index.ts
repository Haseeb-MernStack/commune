import { Router } from "express";
import {
  createCommentSchema,
  createPostSchema,
  loginSchema,
  paginationSchema,
  registerSchema,
  updateProfileSchema,
} from "@commune/shared";
import * as auth from "../controllers/authController.js";
import * as notifications from "../controllers/notificationController.js";
import * as posts from "../controllers/postController.js";
import * as users from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Auth
router.post("/auth/register", authLimiter, validate(registerSchema), asyncHandler(auth.register));
router.post("/auth/login", authLimiter, validate(loginSchema), asyncHandler(auth.login));
router.post("/auth/refresh", authLimiter, asyncHandler(auth.refresh));
router.post("/auth/logout", asyncHandler(auth.logout));

// Users
router.get("/users/me", requireAuth, asyncHandler(users.me));
router.patch("/users/me", requireAuth, validate(updateProfileSchema), asyncHandler(users.updateMe));
router.get("/users/:username", requireAuth, asyncHandler(users.getProfile));
router.get(
  "/users/:username/posts",
  requireAuth,
  validate(paginationSchema, "query"),
  asyncHandler(users.userPosts),
);
router.post("/users/:username/follow", requireAuth, asyncHandler(users.toggleFollow));

// Notifications
router.get("/notifications", requireAuth, asyncHandler(notifications.list));
router.get("/notifications/unread-count", requireAuth, asyncHandler(notifications.unreadCount));
router.post("/notifications/read", requireAuth, asyncHandler(notifications.markAllRead));

// Posts
router.get("/posts", requireAuth, validate(paginationSchema, "query"), asyncHandler(posts.listPosts));
router.post("/posts", requireAuth, validate(createPostSchema), asyncHandler(posts.createPost));
router.get("/posts/:id", requireAuth, asyncHandler(posts.getPost));
router.delete("/posts/:id", requireAuth, asyncHandler(posts.deletePost));
router.post("/posts/:id/like", requireAuth, asyncHandler(posts.toggleLike));
router.get("/posts/:id/comments", requireAuth, asyncHandler(posts.listComments));
router.post(
  "/posts/:id/comments",
  requireAuth,
  validate(createCommentSchema),
  asyncHandler(posts.addComment),
);

router.post(
  "/posts/:id/comments",
  requireAuth,
  validate(createCommentSchema),
  asyncHandler(posts.addComment),
);
