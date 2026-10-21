import bcrypt from "bcryptjs";
import type { Response } from "express";
import type { AuthResponse, LoginInput, RegisterInput } from "@commune/shared";
import { env, isProd } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { conflict, forbidden, unauthorized } from "../utils/errors.js";
import { toPublicUser } from "../utils/serializers.js";
import { generateRefreshToken, hashToken, signAccessToken } from "../utils/tokens.js";

export const REFRESH_COOKIE = "commune_rt";
const COOKIE_PATH = "/api/auth";
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

async function issueSession(res: Response, user: Parameters<typeof toPublicUser>[0]) {
  const { token, hash } = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  setRefreshCookie(res, token);
  const body: AuthResponse = {
    user: toPublicUser(user),
    accessToken: signAccessToken(user._id.toString()),
  };
  return body;
}

export async function register(input: RegisterInput, res: Response) {
  const existing = await User.findOne({ email: input.email })
    .or([{ username: input.username }])
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (existing) throw conflict("Email or username is already taken");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    username: input.username,
    email: input.email,
    passwordHash,
  });
  return issueSession(res, user);
}

export async function login(input: LoginInput, res: Response) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized("Invalid email or password");
  // Checked after the password so the message can't be used to discover which emails exist.
  if (user.banned) throw forbidden("This account has been suspended");
  return issueSession(res, user);
}

/** Rotates the refresh token: the presented token is consumed and a new one issued. */
export async function refresh(presented: string | undefined, res: Response) {
  if (!presented) throw unauthorized("No session");
  const record = await RefreshToken.findOneAndDelete({ tokenHash: hashToken(presented) });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    clearRefreshCookie(res);
    throw unauthorized("Session expired");
  }
  const user = await User.findById(record.user);
  if (!user || user.banned) {
    clearRefreshCookie(res);
    throw unauthorized("Session expired");
  }
  return issueSession(res, user);
}

export async function logout(presented: string | undefined, res: Response) {
  if (presented) await RefreshToken.deleteOne({ tokenHash: hashToken(presented) });
  clearRefreshCookie(res);
}
