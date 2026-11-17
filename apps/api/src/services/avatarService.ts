import type { AvatarAllowance } from "@commune/shared";
import { DAY, QuotaError, consumeQuota, quotaUsage } from "./quota.js";

/** How many times one account may change (or remove) its profile photo in 24 hours. */
export const AVATAR_CHANGES_PER_DAY = 3;
const BUCKET = "avatar:change";

export async function avatarAllowance(userId: string): Promise<AvatarAllowance> {
  const { used, oldest } = await quotaUsage(BUCKET, userId, DAY);
  const remaining = Math.max(0, AVATAR_CHANGES_PER_DAY - used);
  return {
    limit: AVATAR_CHANGES_PER_DAY,
    used,
    remaining,
    resetsAt: remaining === 0 && oldest ? new Date(oldest.getTime() + DAY).toISOString() : null,
  };
}

/** Counts one photo change, or throws 429 with the time it becomes possible again. */
export async function consumeAvatarChange(userId: string): Promise<void> {
  try {
    await consumeQuota([
      {
        bucket: BUCKET,
        subject: userId,
        windows: [{ limit: AVATAR_CHANGES_PER_DAY, windowMs: DAY }],
      },
    ]);
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    const { resetsAt } = await avatarAllowance(userId);
    const hours = resetsAt
      ? Math.max(1, Math.ceil((new Date(resetsAt).getTime() - Date.now()) / 3_600_000))
      : 24;
    throw new QuotaError(
      `You can change your profile photo ${AVATAR_CHANGES_PER_DAY} times a day. Try again in about ${hours} ${hours === 1 ? "hour" : "hours"}.`,
    );
  }
}
