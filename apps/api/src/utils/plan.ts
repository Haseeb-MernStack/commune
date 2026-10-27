/**
 * Commune Plus entitlement rules, in one place so they are easy to read and test.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** After a renewal date passes, access continues this long while a payment is retried. */
export const RENEWAL_GRACE_MS = 3 * DAY_MS;

export const isPlusActive = (plusUntil: Date | null | undefined, now = Date.now()): boolean =>
  plusUntil != null && plusUntil.getTime() > now;

export interface SubscriptionSnapshot {
  status: string;
  cancelled: boolean;
  renewsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Turns a subscription's state into "Plus is active until ...". Returns `now` when there is no
 * access (expired, paused, unpaid), so the result can always be stored directly.
 */
export function plusUntilFor(sub: SubscriptionSnapshot, now = Date.now()): Date {
  const none = new Date(now);
  switch (sub.status) {
    case "active":
    case "on_trial":
      // Cancelled subscriptions keep working until the paid period ends.
      if (sub.cancelled) return sub.endsAt ?? sub.renewsAt ?? none;
      return sub.renewsAt ? new Date(sub.renewsAt.getTime() + RENEWAL_GRACE_MS) : new Date(now + 35 * DAY_MS);
    case "past_due":
      // A renewal payment failed. Keep access briefly while the provider retries.
      return sub.renewsAt ? new Date(sub.renewsAt.getTime() + RENEWAL_GRACE_MS) : none;
    case "cancelled":
      return sub.endsAt ?? none;
    default:
      // expired, paused, unpaid, or anything unknown: no access.
      return none;
  }
}
