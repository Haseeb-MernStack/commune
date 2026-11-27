import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/tokens.js";

const skip = () => env.NODE_ENV === "test";

/** Requests per 15 minutes for one signed-in account, and for one address that is not signed in. */
export const SIGNED_IN_LIMIT = 1500;
export const ANONYMOUS_LIMIT = 300;

/**
 * Who a request counts against. A valid access token counts against its account, so people who
 * share one address (a campus, an office, a mobile carrier) do not use up each other's allowance.
 * Anything else counts against the address. Checking the token needs no database lookup, and a
 * forged or expired token is simply treated as anonymous.
 */
export function requestIdentity(req: Pick<Request, "headers" | "ip">): {
  key: string;
  signedIn: boolean;
} {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      return { key: `user:${verifyAccessToken(header.slice(7))}`, signedIn: true };
    } catch {
      // Expired or invalid: counted by address below.
    }
  }
  return { key: `ip:${req.ip ?? "unknown"}`, signedIn: false };
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (requestIdentity(req).signedIn ? SIGNED_IN_LIMIT : ANONYMOUS_LIMIT),
  keyGenerator: (req) => requestIdentity(req).key,
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

/**
 * Sign in, register and Google sign in are strict. Keeping a session alive (`/auth/refresh`) gets
 * a wider allowance and its own count: every signed-in tab refreshes about every 15 minutes, so
 * many people behind one address would otherwise hit the sign-in limit and be logged out.
 */
const isRefresh = (req: Pick<Request, "path">) => req.path.endsWith("/auth/refresh");
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (isRefresh(req) ? 300 : 20),
  keyGenerator: (req) => `${isRefresh(req) ? "refresh" : "auth"}:${req.ip ?? "unknown"}`,
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

/** Post view pings: generous, since opening posts is normal browsing. */
export const viewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests, slow down." },
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

/** Sending direct messages. */
export const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "You're sending messages too fast, slow down." },
});

/** Starting conversations with new people (the main spam vector for direct messages). */
export const newChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "You've started a lot of conversations, try again later." },
});

/** Subscribing, unsubscribing and changing push settings. */
export const pushLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests, try again later." },
});

/** "Send a test notification" button. */
export const testPushLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Test notifications are limited, try again in a few minutes." },
});

/** Marking a conversation read happens whenever a message arrives while it is open. */
export const readLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Slow down." },
});

/** Browser error reports: public, so keep it tight. */
export const clientErrorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many reports." },
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many messages, try again later." },
});

/** Downloading a full copy of an account is heavy, so it is limited per person. */
export const dataLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many data requests, try again later." },
});

/** Muting and blocking: generous for real use, tight enough to stop scripts. */
export const blockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests, try again later." },
});
