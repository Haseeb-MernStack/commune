import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { isPlusActive } from "../utils/plan.js";
import { verifyAccessToken } from "../utils/tokens.js";

/** Verifies the access token. Stateless: no database lookup. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized("Missing access token"));
  try {
    req.userId = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(unauthorized("Invalid or expired access token"));
  }
};

/**
 * Use after requireAuth on routes that change things. Looks the user up so that suspended
 * accounts are blocked immediately instead of when their access token expires, and so
 * req.userRole is available to later middleware and handlers.
 */
export const requireActive: RequestHandler = async (req, _res, next) => {
  try {
    const user = await User.findById(req.userId).select("role banned emailVerified").lean();
    if (!user) return next(unauthorized("Account not found"));
    if (user.banned) return next(forbidden("This account has been suspended"));
    if (env.REQUIRE_VERIFIED_EMAIL && !user.emailVerified) {
      return next(forbidden("Verify your email address to do this"));
    }
    req.userRole = user.role === "admin" ? "admin" : "user";
    next();
  } catch (err) {
    next(err);
  }
};

/** Use after requireActive. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.userRole !== "admin") return next(forbidden("Admins only"));
  next();
};

/** Use after requireAuth on Commune Plus features. */
export const requirePlus: RequestHandler = async (req, _res, next) => {
  try {
    const user = await User.findById(req.userId).select("plusUntil").lean();
    if (!isPlusActive(user?.plusUntil)) return next(forbidden("Commune Plus is required"));
    next();
  } catch (err) {
    next(err);
  }
};
