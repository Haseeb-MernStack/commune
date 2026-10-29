import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Response } from "express";
import type { AuthResponse, LoginInput, RegisterInput } from "@commune/shared";
import { env, isProd } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { AppError, conflict, forbidden, unauthorized } from "../utils/errors.js";
import { toPublicUser } from "../utils/serializers.js";
import { verifyGoogleIdToken, type GoogleProfile } from "./googleAuth.js";
import { sendVerificationEmailInBackground } from "./accountService.js";
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
  sendVerificationEmailInBackground(user);
  return issueSession(res, user);
}

const MAX_FAILED_LOGINS = 8;
const LOCK_MS = 15 * 60 * 1000;

/** Counts a wrong password in the database (works across serverless instances) and locks after too many. */
async function recordFailedLogin(userId: unknown) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { failedLogins: 1 } },
    { new: true },
  ).select("+failedLogins");
  if (updated && (updated.failedLogins ?? 0) >= MAX_FAILED_LOGINS) {
    await User.updateOne(
      { _id: userId },
      { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MS) } },
    );
  }
}

export async function login(input: LoginInput, res: Response) {
  const user = await User.findOne({ email: input.email }).select(
    "+passwordHash +failedLogins +lockUntil",
  );
  const locked = Boolean(user?.lockUntil && user.lockUntil.getTime() > Date.now());
  // Always compare, even for unknown or locked accounts, so timing reveals nothing.
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || locked || !ok) {
    if (user && !locked) await recordFailedLogin(user._id);
    // The same answer in every case, so it cannot be used to find out which emails exist or
    // which accounts are locked.
    throw unauthorized("Invalid email or password");
  }
  if ((user.failedLogins ?? 0) > 0 || user.lockUntil) {
    await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockUntil: null } });
  }
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

/** Accounts created with Google get a random password nobody knows, so password login is off. */
const randomPasswordHash = () => bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

async function uniqueUsername(profile: GoogleProfile): Promise<string> {
  const raw = profile.name ?? profile.email.split("@")[0] ?? "";
  let base = raw.normalize("NFKD").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  if (base.length < 3) base = "user";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}${crypto.randomInt(0, 10000).toString().padStart(4, "0")}`;
    const taken = await User.exists({ username: candidate }).collation({
      locale: "en",
      strength: 2,
    });
    if (!taken) return candidate;
  }
  return `user${crypto.randomBytes(5).toString("hex")}`;
}

/** Sign in, or sign up, with a Google ID token. */
export async function loginWithGoogle(credential: string, res: Response) {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "Google sign-in is not set up");
  const google = await verifyGoogleIdToken(credential);

  let user = await User.findOne({ googleId: google.sub });
  if (!user) {
    const existing = await User.findOne({ email: google.email });
    if (existing) {
      existing.googleId = google.sub;
      if (!existing.emailVerified) {
        // Someone may have registered this address with a password before its real owner
        // arrived. Google just proved ownership, so cancel any password and sessions that
        // were set up without that proof.
        existing.passwordHash = await randomPasswordHash();
        existing.emailVerified = true;
        await RefreshToken.deleteMany({ user: existing._id });
      }
      await existing.save();
      user = existing;
    } else {
      user = await User.create({
        username: await uniqueUsername(google),
        email: google.email,
        passwordHash: await randomPasswordHash(),
        googleId: google.sub,
        emailVerified: true,
      });
    }
  }
  if (user.banned) throw forbidden("This account has been suspended");
  return issueSession(res, user);
}
