import crypto from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../models/User.js";
import { QuotaError } from "./quota.js";
import { newDeviceMail } from "./emailTemplates.js";
import { reserveMail } from "./mailQuota.js";
import { sendMail } from "./mailService.js";

export interface DeviceInfo {
  family: string;
  os: string;
}

/** Browser family and operating system guessed from a User-Agent header. */
export function parseDevice(userAgent: string | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  let family = "Unknown browser";
  if (/Edg\//.test(ua)) family = "Edge";
  else if (/OPR\//.test(ua)) family = "Opera";
  else if (/SamsungBrowser\//.test(ua)) family = "Samsung Internet";
  else if (/Chrome\//.test(ua)) family = "Chrome";
  else if (/Firefox\//.test(ua)) family = "Firefox";
  else if (/Version\//.test(ua) && /Safari\//.test(ua)) family = "Safari";
  let os = "Unknown OS";
  if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { family, os };
}

/** Short human-readable device description, such as "Chrome on Windows". */
export function deviceLabel(device: DeviceInfo): string {
  return `${device.family} on ${device.os}`;
}

/** SHA-256 hash of the device description. Only the hash is stored, never the raw header. */
export function deviceHash(userAgent: string | undefined): string {
  return crypto
    .createHash("sha256")
    .update(deviceLabel(parseDevice(userAgent)))
    .digest("hex");
}

export interface DeviceUser {
  _id: Types.ObjectId;
  email: string;
  username: string;
  knownDeviceHashes?: string[];
}

/**
 * Records the device and emails the owner when it signs in for the first time.
 * Returns true when a notice was sent. Never throws, so sign-in never fails
 * because the notice could not be sent.
 */
export async function notifyNewDeviceIfNeeded(
  user: DeviceUser,
  userAgent: string | undefined,
): Promise<boolean> {
  const hash = deviceHash(userAgent);
  if ((user.knownDeviceHashes ?? []).includes(hash)) return false;
  try {
    // Reserve first: when the quota is full the hash stays unrecorded, so the
    // next sign-in from this device tries again instead of losing the notice.
    await reserveMail({ kind: "alert" });
    const recorded = await User.updateOne(
      { _id: user._id, knownDeviceHashes: { $ne: hash } },
      { $addToSet: { knownDeviceHashes: hash } },
    );
    if (recorded.modifiedCount !== 1) return false;
    const label = deviceLabel(parseDevice(userAgent));
    await sendMail(
      newDeviceMail(
        user.email,
        user.username,
        label,
        new Date().toUTCString(),
        `${env.CLIENT_ORIGIN}/forgot-password`,
      ),
    );
    return true;
  } catch (error) {
    if (error instanceof QuotaError) {
      logger.warn({ error }, "Skipped the new-device notice: the mail quota is full");
    } else {
      logger.error({ error }, "Failed to send the new-device notice");
    }
    return false;
  }
}

/** Fire-and-forget wrapper so a slow or failing notice never delays sign-in. */
export function notifyNewDeviceInBackground(user: DeviceUser, userAgent: string | undefined): void {
  notifyNewDeviceIfNeeded(user, userAgent).catch((error: unknown) => {
    logger.error({ error }, "Failed to send the new-device notice");
  });
}
