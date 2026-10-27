import { env, isProd } from "../config/env.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import type { BillingDTO } from "@commune/shared";
import { logger } from "../config/logger.js";
import { isPlusActive, plusUntilFor } from "../utils/plan.js";
import type { WebhookEvent } from "./paymentService.js";
import { paymentsMode, plusAvailable } from "./paymentService.js";

type SubscriptionEvent = Extract<WebhookEvent, { kind: "subscription" }>;

/**
 * Applies one Lemon Squeezy subscription snapshot: stores it and recomputes the user's
 * plusUntil. Safe to call repeatedly and out of order.
 */
export async function applySubscriptionEvent(event: SubscriptionEvent): Promise<void> {
  if (!event.userId) {
    // Subscriptions bought outside our checkout carry no user id; we can't tell whose it is.
    logger.error({ subscriptionId: event.subscriptionId }, "Subscription event without a user id");
    return;
  }

  const existing = await Subscription.findOne({ providerSubscriptionId: event.subscriptionId })
    .select("providerUpdatedAt")
    .lean();
  if (existing && existing.providerUpdatedAt.getTime() > event.updatedAt.getTime()) return; // stale

  const snapshot = {
    status: event.status,
    cancelled: event.cancelled,
    renewsAt: event.renewsAt,
    endsAt: event.endsAt,
  };
  await Subscription.findOneAndUpdate(
    { providerSubscriptionId: event.subscriptionId },
    {
      $set: {
        user: event.userId,
        provider: "lemonsqueezy",
        providerCustomerId: event.customerId,
        providerUpdatedAt: event.updatedAt,
        ...snapshot,
      },
    },
    { upsert: true },
  );
  await User.updateOne({ _id: event.userId }, { $set: { plusUntil: plusUntilFor(snapshot) } });
}

/** Local-development stand-in for a purchase: 30 days of Plus, no payment. Never in production. */
export async function activateMockPlus(userId: string): Promise<void> {
  if (isProd) throw new Error("Mock billing is disabled in production");
  const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const snapshot = { status: "active", cancelled: false, renewsAt, endsAt: null };
  await Subscription.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        provider: "mock",
        providerSubscriptionId: `mock_${userId}`,
        providerUpdatedAt: new Date(),
        ...snapshot,
      },
    },
    { upsert: true },
  );
  await User.updateOne({ _id: userId }, { $set: { plusUntil: plusUntilFor(snapshot) } });
}

/** Local-development stand-in for cancelling in the customer portal: access ends right away. */
export async function cancelMockPlus(userId: string): Promise<void> {
  if (isProd) throw new Error("Mock billing is disabled in production");
  await Subscription.updateOne(
    { user: userId },
    { $set: { status: "cancelled", cancelled: true, endsAt: new Date(), providerUpdatedAt: new Date() } },
  );
  await User.updateOne({ _id: userId }, { $set: { plusUntil: new Date() } });
}

export async function billingFor(userId: string): Promise<BillingDTO> {
  const [user, sub] = await Promise.all([
    User.findById(userId).select("plusUntil").lean(),
    Subscription.findOne({ user: userId }).select("status cancelled").lean(),
  ]);
  return {
    plus: isPlusActive(user?.plusUntil),
    plusUntil: user?.plusUntil ? user.plusUntil.toISOString() : null,
    cancelled: Boolean(sub?.cancelled),
    status: sub?.status ?? null,
    priceLabel: env.PLUS_PRICE_LABEL,
    available: plusAvailable && paymentsMode !== null,
  };
}
