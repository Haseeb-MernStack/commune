import webpush from "web-push";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { User } from "../models/User.js";
import { activeUsers } from "./realtime.js";

export type PushKind = "message" | "social" | "test";

export interface PushPayload {
  title: string;
  body: string;
  /** A path on this site, opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

/** True when VAPID keys are set. Checked on every call so it can be configured at any time. */
export const pushConfigured = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

let configuredFor = "";
function configure() {
  const key = `${env.VAPID_PUBLIC_KEY}|${env.VAPID_PRIVATE_KEY}|${env.VAPID_SUBJECT ?? ""}`;
  if (key === configuredFor) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT ?? env.CLIENT_ORIGIN, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  configuredFor = key;
}

/**
 * Sends a push notification to every device of a user who wants it. Never throws: a failed push
 * must not break the message, like or comment that caused it.
 *
 * Skipped when the person turned that kind off, is suspended, or has the site open and visible
 * (they already see it live). Devices the push service reports as gone are removed.
 */
export async function pushToUser(
  userId: string,
  kind: PushKind,
  payload: PushPayload,
): Promise<void> {
  if (!pushConfigured()) return;
  try {
    configure();
    if (kind !== "test") {
      const user = (await User.findById(userId).select("pushMessages pushSocial banned").lean()) as {
        pushMessages?: boolean;
        pushSocial?: boolean;
        banned?: boolean;
      } | null;
      if (!user || user.banned) return;
      if (kind === "message" && user.pushMessages === false) return;
      if (kind === "social" && user.pushSocial === false) return;
      if ((await activeUsers([userId])).has(userId)) return;
    }

    const subs = await PushSubscription.find({ user: userId }).lean();
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title.slice(0, 80),
      body: payload.body.slice(0, 140),
      url: payload.url,
      tag: payload.tag,
    });
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: 60 * 60, urgency: kind === "message" ? "high" : "normal", timeout: 2500 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // The person uninstalled the app or revoked permission.
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            logger.warn({ status }, "Push delivery failed");
          }
        }
      }),
    );
  } catch (err) {
    logger.warn({ err: String(err) }, "Push failed");
  }
}
