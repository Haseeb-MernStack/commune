import type { NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg = "Bad request") => new AppError(400, msg);
export const unauthorized = (msg = "Unauthorized") => new AppError(401, msg);
export const forbidden = (msg = "Forbidden") => new AppError(403, msg);
export const notFound = (msg = "Not found") => new AppError(404, msg);
export const conflict = (msg = "Conflict") => new AppError(409, msg);

/** Forwards rejected promises from async handlers to the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
