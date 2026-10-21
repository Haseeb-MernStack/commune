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
