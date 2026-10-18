import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  // Mongo duplicate key
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ error: "Already exists" });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
