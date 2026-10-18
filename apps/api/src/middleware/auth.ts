import type { RequestHandler } from "express";
import { unauthorized } from "../utils/errors.js";
import { verifyAccessToken } from "../utils/tokens.js";

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
