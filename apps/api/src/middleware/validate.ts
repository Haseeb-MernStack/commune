import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { badRequest } from "../utils/errors.js";

/**
 * Validates req.body (or req.query). Parsed bodies replace req.body;
 * parsed queries are stored on res.locals.query.
 */
export const validate =
  (schema: ZodTypeAny, source: "body" | "query" = "body"): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest(result.error.issues[0]?.message ?? "Invalid input"));
    }
    if (source === "body") req.body = result.data;
    else res.locals.query = result.data;
    next();
  };
