import express from "express";
import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { CheckoutResponse } from "@commune/shared";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Post } from "../models/Post.js";
import { Purchase } from "../models/Purchase.js";
import { User } from "../models/User.js";
import {
  createCheckoutUrl,
  parseWebhook,
  paymentsMode,
  verifyWebhookSignature,
} from "../services/paymentService.js";
import { applySubscriptionEvent } from "../services/billingService.js";
import { earningsFor, recordPurchase } from "../services/purchaseService.js";
import { AppError, badRequest, conflict, notFound } from "../utils/errors.js";

/** Starts a purchase of one post. Returns the URL the browser should go to next. */
export async function checkout(req: Request, res: Response) {
  const id = req.params.id;
  if (!id || !mongoose.isValidObjectId(id)) throw badRequest("Invalid id");

  const post = await Post.findById(id).select("author priceCents").lean();
  if (!post) throw notFound("Post not found");
  if (post.priceCents == null) throw badRequest("This post is free");
  if (post.author.toString() === req.userId) throw badRequest("You can't buy your own post");
  if (await Purchase.exists({ user: req.userId, post: id })) {
    throw conflict("You have already unlocked this post");
  }

  if (paymentsMode === null) throw new AppError(503, "Payments are not set up yet");

  if (paymentsMode === "mock") {
    // Local testing only: pay nothing, unlock immediately.
    await recordPurchase({
      userId: req.userId!,
      postId: id,
      creatorId: post.author.toString(),
      amountCents: post.priceCents,
      currency: "USD",
      provider: "mock",
      orderId: `mock_${id}_${req.userId}`,
    });
    const body: CheckoutResponse = { url: `${env.CLIENT_ORIGIN}/posts/${id}?unlocked=1` };
    res.json(body);
    return;
  }

  const buyer = await User.findById(req.userId).select("email").lean();
  try {
    const url = await createCheckoutUrl({
      postId: id,
      userId: req.userId!,
      email: buyer?.email ?? "",
      priceCents: post.priceCents,
    });
    const body: CheckoutResponse = { url };
    res.json(body);
  } catch (err) {
    logger.error({ err }, "Could not create checkout");
    throw new AppError(502, "Payments are unavailable right now, try again later");
  }
}

export async function earnings(req: Request, res: Response) {
  res.json(await earningsFor(req.userId!));
}

/** Body parser for the webhook: the signature is over the exact bytes, so keep them raw. */
export const rawBody = express.raw({ type: "*/*", limit: "200kb" });

/**
 * Lemon Squeezy calls this after a payment. Mounted in app.ts BEFORE the JSON parser.
 * Always answers 200 for events we choose to ignore, so the provider doesn't keep retrying.
 */
export async function lemonSqueezyWebhook(req: Request, res: Response) {
  if (paymentsMode !== "lemonsqueezy") {
    res.status(503).json({ error: "Payments are not configured" });
    return;
  }
  const body = req.body as Buffer;
  const signature = req.get("X-Signature");
  if (!Buffer.isBuffer(body) || !verifyWebhookSignature(body, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const event = parseWebhook(payload);
  if (event.kind === "refunded") {
    // Revoke access and take the sale out of the creator's earnings.
    await Purchase.deleteOne({ provider: "lemonsqueezy", providerOrderId: event.orderId });
  } else if (event.kind === "subscription") {
    await applySubscriptionEvent(event);
  } else if (event.kind === "paid") {
    const valid =
      mongoose.isValidObjectId(event.postId) && mongoose.isValidObjectId(event.userId);
    const post = valid ? await Post.findById(event.postId).select("author priceCents").lean() : null;
    if (!post || post.priceCents == null) {
      // Paid for a post that no longer exists. Log loudly: this needs a manual refund.
      logger.error({ event }, "Payment received for a missing or free post");
    } else {
      await recordPurchase({
        userId: event.userId,
        postId: event.postId,
        creatorId: post.author.toString(),
        amountCents: event.amountCents,
        currency: event.currency,
        provider: "lemonsqueezy",
        orderId: event.orderId,
      });
    }
  }
  res.json({ received: true });
}
