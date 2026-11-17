import type { RequestHandler } from "express";
import { consumeQuota, type Window } from "../services/quota.js";

/**
 * Per-account limit for something that costs money or storage (uploads, checkouts), counted in
 * the database so it holds across serverless instances and cannot be dodged by changing IP.
 * Run it after requireAuth.
 */
export const userQuota =
  (bucket: string, windows: Window[], message?: string): RequestHandler =>
  (req, _res, next) => {
    consumeQuota([{ bucket, subject: req.userId ?? req.ip ?? "unknown", windows }], message).then(
      () => next(),
      next,
    );
  };
