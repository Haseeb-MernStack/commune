import mongoose from "mongoose";
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
  const existing = await Subscription.findOne({ providerSubscriptionId: event.subscriptionId })
    .select("user providerUpdatedAt")
    .lean();
  if (existing && existing.providerUpdatedAt.getTime() > event.updatedAt.getTime()) return; // stale

  // Whose subscription is this? Our checkout tags it with the user id. If that is missing (a
  // subscription made outside our checkout), fall back to the account we already linked to it,
  // then to the buyer's email address (the webhook is signed, so the email can be trusted).
  let rawUserId = event.userId ?? existing?.user?.toString() ?? null;
  // The id comes from the webhook body: only ever use it as a real ObjectId, never as a query
  // object or operator.
  if (rawUserId && !mongoose.isValidObjectId(rawUserId)) rawUserId = null;
  let userId = rawUserId;
  if (!userId && event.email) {
    const byEmail = await User.findOne({ email: event.email.toLowerCase() }).select("_id").lean();
    userId = byEmail?._id.toString() ?? null;
  }
  if (!userId || !mongoose.isValidObjectId(userId)) {
    logger.error(
      { subscriptionId: event.subscriptionId },
      "Subscription event for an unknown user",
    );
    return;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
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
        user: userObjectId,
        provider: "lemonsqueezy",
        providerCustomerId: event.customerId,
        providerUpdatedAt: event.updatedAt,
        testMode: event.testMode,
        ...snapshot,
      },
    },
    { upsert: true },
  );
  await User.updateOne({ _id: userObjectId }, { $set: { plusUntil: plusUntilFor(snapshot) } });
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
    {
      $set: {
        status: "cancelled",
        cancelled: true,
        endsAt: new Date(),
        providerUpdatedAt: new Date(),
      },
    },
  );
  await User.updateOne({ _id: userId }, { $set: { plusUntil: new Date() } });
}

export async function billingFor(userId: string): Promise<BillingDTO> {
  const [user, sub] = await Promise.all([
    User.findById(userId).select("plusUntil").lean(),
    Subscription.findOne({ user: userId }).select("status cancelled renewsAt endsAt").lean(),
  ]);
  return {
    plus: isPlusActive(user?.plusUntil),
    plusUntil: user?.plusUntil ? user.plusUntil.toISOString() : null,
    cancelled: Boolean(sub?.cancelled),
    status: sub?.status ?? null,
    renewsAt: sub?.renewsAt ? new Date(sub.renewsAt).toISOString() : null,
    endsAt: sub?.endsAt ? new Date(sub.endsAt).toISOString() : null,
    // A renewal payment failed: access continues briefly while the provider retries the card.
    pastDue: sub?.status === "past_due",
    testMode: paymentsMode === "lemonsqueezy" && env.LEMONSQUEEZY_ACCEPT_TEST_MODE,
    priceLabel: env.PLUS_PRICE_LABEL,
    available: plusAvailable && paymentsMode !== null,
  };
}
