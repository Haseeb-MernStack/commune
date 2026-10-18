import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { notFound } from "../utils/errors.js";
import { toPublicUser } from "../utils/serializers.js";

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.userId).lean();
  if (!user) throw notFound("User not found");
  res.json(toPublicUser(user));
}
