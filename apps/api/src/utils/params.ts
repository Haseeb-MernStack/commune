import mongoose from "mongoose";
import type { Request } from "express";
import { badRequest } from "./errors.js";

/** Reads a route param that must be a valid MongoDB ObjectId, or throws a 400. */
export function idParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value || !mongoose.isValidObjectId(value)) throw badRequest("Invalid id");
  return value;
}
