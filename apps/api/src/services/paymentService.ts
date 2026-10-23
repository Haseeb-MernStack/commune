import crypto from "node:crypto";
import { env, isProd } from "../config/env.js";

/**
 * Payments through Lemon Squeezy, a "merchant of record": it charges the buyer, handles sales
 * tax and VAT, and pays the platform. Everything provider-specific lives in this file, so
 * another provider (Paddle, Stripe) only needs a replacement for these functions.
 *
 * Modes:
 *  - "lemonsqueezy": all four LEMONSQUEEZY_* variables are set.
 *  - "mock": outside production with none set. Checkout instantly "buys" the post so the
 *    feature can be tried locally. Never active in production.
 *  - null: production without configuration; checkout answers 503.
 */
const ls =
  env.LEMONSQUEEZY_API_KEY &&
  env.LEMONSQUEEZY_STORE_ID &&
  env.LEMONSQUEEZY_VARIANT_ID &&
  env.LEMONSQUEEZY_WEBHOOK_SECRET
    ? {
        apiKey: env.LEMONSQUEEZY_API_KEY,
        storeId: env.LEMONSQUEEZY_STORE_ID,
        variantId: env.LEMONSQUEEZY_VARIANT_ID,
        webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET,
      }
    : null;

export type PaymentsMode = "lemonsqueezy" | "mock" | null;
export const paymentsMode: PaymentsMode = ls ? "lemonsqueezy" : isProd ? null : "mock";

export interface CheckoutRequest {
  postId: string;
  userId: string;
  email: string;
  priceCents: number;
}

/** Creates a hosted checkout for one post at its price and returns the URL to send the buyer to. */
export async function createCheckoutUrl(req: CheckoutRequest): Promise<string> {
  if (!ls) throw new Error("Lemon Squeezy is not configured");
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${ls.apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: req.priceCents,
          product_options: {
            name: "Unlock a post on Commune",
            redirect_url: `${env.CLIENT_ORIGIN}/posts/${req.postId}?unlocked=1`,
          },
          checkout_data: {
            email: req.email,
            // Echoed back in the webhook, which is how we know who bought what.
            custom: { post_id: req.postId, user_id: req.userId },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: ls.storeId } },
          variant: { data: { type: "variants", id: ls.variantId } },
        },
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy returned ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = body.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy response had no checkout URL");
  return url;
}

/** Lemon Squeezy signs the raw request body with HMAC-SHA256 and sends the hex digest. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!ls || !signature) return false;
  const expected = crypto.createHmac("sha256", ls.webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type WebhookEvent =
  | {
      kind: "paid";
      orderId: string;
      postId: string;
      userId: string;
      amountCents: number;
      currency: string;
    }
  | { kind: "refunded"; orderId: string }
  | { kind: "ignored" };

interface OrderPayload {
  meta?: { event_name?: string; custom_data?: { post_id?: string; user_id?: string } };
  data?: {
    id?: string | number;
    attributes?: {
      status?: string;
      subtotal?: number;
      discount_total?: number;
      currency?: string;
    };
  };
}

/** Reads the parts of a Lemon Squeezy order webhook we care about. */
export function parseWebhook(payload: unknown): WebhookEvent {
  const p = payload as OrderPayload;
  const event = p.meta?.event_name;
  const orderId = p.data?.id != null ? String(p.data.id) : null;
  if (!orderId) return { kind: "ignored" };

  if (event === "order_refunded") return { kind: "refunded", orderId };

  const a = p.data?.attributes;
  const postId = p.meta?.custom_data?.post_id;
  const userId = p.meta?.custom_data?.user_id;
  if (event === "order_created" && a?.status === "paid" && postId && userId) {
    // The creator's share is based on what the buyer paid before tax (tax goes to the
    // authorities, not to us), minus any discount.
    const amountCents = Math.max(0, (a.subtotal ?? 0) - (a.discount_total ?? 0));
    return {
      kind: "paid",
      orderId,
      postId,
      userId,
      amountCents,
      currency: (a.currency ?? "USD").toUpperCase(),
    };
  }
  return { kind: "ignored" };
}
