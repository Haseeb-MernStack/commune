import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const skip = () => env.NODE_ENV === "test";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests, slow down." },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many uploads, try again later." },
});

export const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "You're reporting too fast, try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many attempts, try again later." },
});

/** Anything that sends an email: forgot password and resend verification. */
export const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many email requests, try again later." },
});

export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many checkout attempts, try again later." },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Searching too fast, try again in a moment." },
});

/** Unauthenticated read-only endpoints (the public Explore page). */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests, slow down." },
});

export const communityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "You're creating communities too fast, try again later." },
});
