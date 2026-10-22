import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AuthToken } from "../models/AuthToken.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { badRequest } from "../utils/errors.js";
import { generateRefreshToken, hashToken } from "../utils/tokens.js";
import { resetPasswordMail, verifyEmailMail } from "./emailTemplates.js";
import { sendMail } from "./mailService.js";

type Purpose = "verify_email" | "reset_password";

const TTL_MS: Record<Purpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** Replaces any earlier token of this kind for the user and returns the new raw token. */
async function createToken(userId: unknown, purpose: Purpose) {
  const { token, hash } = generateRefreshToken();
  await AuthToken.deleteMany({ user: userId, purpose });
  await AuthToken.create({
    user: userId,
    purpose,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });
  return token;
}

/** Consumes a token (single use). Returns the user id, or throws if unknown or expired. */
async function consumeToken(raw: string, purpose: Purpose) {
  const record = await AuthToken.findOneAndDelete({ tokenHash: hashToken(raw), purpose });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw badRequest("This link is invalid or has expired");
  }
  return record.user;
}

interface Recipient {
  _id: unknown;
  email: string;
  username: string;
}

export async function sendVerificationEmail(user: Recipient) {
  const token = await createToken(user._id, "verify_email");
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${token}`;
  await sendMail(verifyEmailMail(user.email, user.username, link));
}

/** For flows where the caller must not wait on, or learn about, email delivery. */
export function sendVerificationEmailInBackground(user: Recipient) {
  sendVerificationEmail(user).catch((err: unknown) =>
    logger.error({ err }, "Could not send verification email"),
  );
}

export async function verifyEmail(raw: string) {
  const userId = await consumeToken(raw, "verify_email");
  await User.updateOne({ _id: userId }, { $set: { emailVerified: true } });
}

/** Always resolves, whether or not the email belongs to an account (no account discovery). */
export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email }).select("email username banned").lean();
  if (!user || user.banned) return;
  const token = await createToken(user._id, "reset_password");
  const link = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
  sendMail(resetPasswordMail(user.email, user.username, link)).catch((err: unknown) =>
    logger.error({ err }, "Could not send password reset email"),
  );
}

export async function resetPassword(raw: string, password: string) {
  const userId = await consumeToken(raw, "reset_password");
  const passwordHash = await bcrypt.hash(password, 12);
  // Receiving the email also proves the mailbox is theirs, so mark it verified.
  await User.updateOne({ _id: userId }, { $set: { passwordHash, emailVerified: true } });
  // Sign the account out everywhere: a reset usually means someone else may have had access.
  await RefreshToken.deleteMany({ user: userId });
  // Any other pending reset links for this account are now useless.
  await AuthToken.deleteMany({ user: userId, purpose: "reset_password" });
}
