import type { Request, Response } from "express";
import * as accountService from "../services/accountService.js";
import { User } from "../models/User.js";
import { forbidden, notFound } from "../utils/errors.js";

export async function forgotPassword(req: Request, res: Response) {
  await accountService.requestPasswordReset((req.body as { email: string }).email);
  // Same answer for every address so the endpoint can't be used to find registered emails.
  res.status(202).json({ message: "If that email has an account, a reset link is on its way." });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as { token: string; password: string };
  await accountService.resetPassword(token, password);
  res.status(204).end();
}

export async function verifyEmail(req: Request, res: Response) {
  await accountService.verifyEmail((req.body as { token: string }).token);
  res.status(204).end();
}

export async function resendVerification(req: Request, res: Response) {
  const user = await User.findById(req.userId).select("email username emailVerified banned").lean();
  if (!user) throw notFound("User not found");
  if (user.banned) throw forbidden("This account has been suspended");
  if (!user.emailVerified) await accountService.sendVerificationEmail(user);
  res.status(204).end();
}
