import type { RequestHandler } from "express";
import { env, isProd } from "../config/env.js";
import { logger } from "../config/logger.js";
import { forbidden } from "../utils/errors.js";

/** Default for every API response: private and uncacheable. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence in depth against cross-site request forgery: a browser always sends an Origin header
 * on a cross-site write, so a write from any origin other than our web app is refused. Requests
 * without an Origin (server to server, curl) are not browsers and are left to the token checks.
 * Only enforced in production, where CLIENT_ORIGIN is the real site address.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (!isProd || SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && origin !== env.CLIENT_ORIGIN) {
    logger.warn({ origin, path: req.path }, "Blocked write from an unexpected origin");
    return next(forbidden("Request origin not allowed"));
  }
  next();
};
