import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  // The method and path are echoed (query string removed) so a bad proxy or rewrite setup can
  // be diagnosed from the error shown in the browser.
  const path = req.originalUrl.split("?")[0];
  logger.warn({ method: req.method, path }, "Route not found");
  res.status(404).json({ error: `Route not found: ${req.method} ${path}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  // Body too large or other client errors raised by the body parser
  const status = (err as { status?: number; statusCode?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res
      .status(status)
      .json({ error: status === 413 ? "Request is too large" : "Invalid request" });
  }
  // A malformed id in a URL (not a valid ObjectId)
  if ((err as { name?: string }).name === "CastError") {
    return res.status(404).json({ error: "Not found" });
  }
  // Mongo duplicate key
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ error: "Already exists" });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
