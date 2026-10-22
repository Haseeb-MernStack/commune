import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Provider configuration must exist before the config module is first imported.
vi.hoisted(() => {
  process.env.LEMONSQUEEZY_API_KEY = "ls_key";
  process.env.LEMONSQUEEZY_STORE_ID = "111";
  process.env.LEMONSQUEEZY_VARIANT_ID = "222";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_test";
});

import { createApp } from "../app.js";
import { Post } from "../models/Post.js";
import { Purchase } from "../models/Purchase.js";
import { User } from "../models/User.js";
import { parseWebhook } from "../services/paymentService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const BUYER = new mongoose.Types.ObjectId().toString();
const CREATOR = new mongoose.Types.ObjectId().toString();
const POST_ID = new mongoose.Types.ObjectId().toString();
const auth = { Authorization: `Bearer ${signAccessToken(BUYER)}` };
const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const order = (overrides: Record<string, unknown> = {}, event = "order_created") => ({
  meta: { event_name: event, custom_data: { post_id: POST_ID, user_id: BUYER } },
  data: {
    id: "9001",
    attributes: { status: "paid", subtotal: 1000, discount_total: 0, currency: "usd", ...overrides },
  },
});

const sign = (raw: string) =>
  crypto.createHmac("sha256", "whsec_test").update(raw).digest("hex");

function send(payload: unknown, signature?: string) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post("/api/webhooks/lemonsqueezy")
    .set("Content-Type", "application/json")
    .set("X-Signature", signature ?? sign(raw))
    .send(raw);
}

describe("checkout with Lemon Squeezy", () => {
  it("creates a hosted checkout at the post's price and returns its URL", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: CREATOR, priceCents: 750 }) as never);
    vi.spyOn(Purchase, "exists").mockResolvedValue(null as never);
    vi.spyOn(User, "findById").mockReturnValue(chain({ email: "buyer@example.com" }) as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { attributes: { url: "https://shop.lemonsqueezy.com/checkout/x" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://shop.lemonsqueezy.com/checkout/x");

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    expect(init.headers.Authorization).toBe("Bearer ls_key");
    const body = JSON.parse(init.body) as {
      data: {
        attributes: {
          custom_price: number;
          checkout_data: { email: string; custom: Record<string, string> };
        };
        relationships: { store: { data: { id: string } }; variant: { data: { id: string } } };
      };
    };
    expect(body.data.attributes.custom_price).toBe(750);
    expect(body.data.attributes.checkout_data.custom).toEqual({ post_id: POST_ID, user_id: BUYER });
    expect(body.data.relationships.store.data.id).toBe("111");
    expect(body.data.relationships.variant.data.id).toBe("222");
  });

  it("returns 502 when the provider fails, without leaking details", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: CREATOR, priceCents: 750 }) as never);
    vi.spyOn(Purchase, "exists").mockResolvedValue(null as never);
    vi.spyOn(User, "findById").mockReturnValue(chain({ email: "b@example.com" }) as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "secret detail" }),
    );
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret detail");
  });
});

describe("POST /api/webhooks/lemonsqueezy", () => {
  it("rejects a missing or wrong signature and records nothing", async () => {
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    expect((await send(order(), "deadbeef")).status).toBe(401);
    const noHeader = await request(app)
      .post("/api/webhooks/lemonsqueezy")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(order()));
    expect(noHeader.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("records a paid order with the fee split", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: CREATOR, priceCents: 1000 }) as never);
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    const res = await send(order());
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: BUYER,
        post: POST_ID,
        creator: CREATOR,
        amountCents: 1000,
        feeCents: 200,
        creatorShareCents: 800,
        currency: "USD",
        provider: "lemonsqueezy",
        providerOrderId: "9001",
      }),
    );
  });

  it("subtracts discounts from the amount", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: CREATOR, priceCents: 1000 }) as never);
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    await send(order({ discount_total: 250 }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 750 }));
  });

  it("treats a redelivered webhook as success without double counting", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: CREATOR, priceCents: 1000 }) as never);
    vi.spyOn(Purchase, "create").mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const res = await send(order());
    expect(res.status).toBe(200);
  });

  it("ignores unpaid orders and unrelated events", async () => {
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    expect((await send(order({ status: "pending" }))).status).toBe(200);
    expect((await send(order({}, "subscription_created"))).status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });

  it("revokes access on a refund", async () => {
    const del = vi.spyOn(Purchase, "deleteOne").mockResolvedValue({} as never);
    const res = await send(order({}, "order_refunded"));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith({ provider: "lemonsqueezy", providerOrderId: "9001" });
  });
});

describe("parseWebhook", () => {
  it("ignores payloads without an order id", () => {
    expect(parseWebhook({})).toEqual({ kind: "ignored" });
  });
});
