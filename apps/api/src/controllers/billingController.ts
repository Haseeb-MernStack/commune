import type { Request, Response } from "express";
import type { CheckoutResponse } from "@commune/shared";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import {
  activateMockPlus,
  billingFor,
  cancelMockPlus,
} from "../services/billingService.js";
import {
  createPlusCheckoutUrl,
  getCustomerPortalUrl,
  paymentsMode,
  plusAvailable,
} from "../services/paymentService.js";
import { AppError, badRequest, conflict, notFound } from "../utils/errors.js";
import { isPlusActive } from "../utils/plan.js";

export async function status(req: Request, res: Response) {
  res.json(await billingFor(req.userId!));
}

/** Starts the Commune Plus purchase. Returns the URL to send the browser to. */
export async function checkout(req: Request, res: Response) {
  if (!plusAvailable || paymentsMode === null) throw new AppError(503, "Commune Plus isn't available yet");

  const user = await User.findById(req.userId).select("email plusUntil").lean();
  if (!user) throw notFound("User not found");
  const sub = await Subscription.findOne({ user: req.userId }).select("cancelled").lean();
  // An active, non-cancelled subscription must not be bought twice. A cancelled one may be
  // re-bought even while its paid period runs on.
  if (isPlusActive(user.plusUntil) && !sub?.cancelled) {
    throw conflict("You already have Commune Plus");
  }

  if (paymentsMode === "mock") {
    await activateMockPlus(req.userId!);
    const body: CheckoutResponse = { url: `${env.CLIENT_ORIGIN}/plus?welcome=1` };
    res.json(body);
    return;
  }

  try {
    const url = await createPlusCheckoutUrl({ userId: req.userId!, email: user.email });
    const body: CheckoutResponse = { url };
    res.json(body);
  } catch (err) {
    logger.error({ err }, "Could not create Plus checkout");
    throw new AppError(502, "Payments are unavailable right now, try again later");
  }
}

/** Link to the provider's customer portal, where members update their card or cancel. */
export async function portal(req: Request, res: Response) {
  const sub = await Subscription.findOne({ user: req.userId })
    .select("provider providerSubscriptionId")
    .lean();
  if (!sub) throw badRequest("You don't have a subscription");

  if (sub.provider === "mock") {
    await cancelMockPlus(req.userId!);
    const body: CheckoutResponse = { url: `${env.CLIENT_ORIGIN}/plus` };
    res.json(body);
    return;
  }
  try {
    const body: CheckoutResponse = { url: await getCustomerPortalUrl(sub.providerSubscriptionId) };
    res.json(body);
  } catch (err) {
    logger.error({ err }, "Could not get customer portal link");
    throw new AppError(502, "Billing portal is unavailable right now, try again later");
  }
}
