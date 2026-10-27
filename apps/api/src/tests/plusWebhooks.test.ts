import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Provider configuration must exist before the config module is first imported.
vi.hoisted(() => {
  process.env.LEMONSQUEEZY_API_KEY = "ls_key";
  process.env.LEMONSQUEEZY_STORE_ID = "111";
  process.env.LEMONSQUEEZY_VARIANT_ID = "222";
  process.env.LEMONSQUEEZY_PLUS_VARIANT_ID = "333";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_test";
});

import { createApp } from "../app.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { RENEWAL_GRACE_MS } from "../utils/plan.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const USER = new mongoose.Types.ObjectId().toString();
const auth = { Authorization: `Bearer ${signAccessToken(USER)}` };
const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sign = (raw: string) => crypto.createHmac("sha256", "whsec_test").update(raw).digest("hex");

function send(payload: unknown) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post("/api/webhooks/lemonsqueezy")
    .set("Content-Type", "application/json")
    .set("X-Signature", sign(raw))
    .send(raw);
}

const subscriptionEvent = (
  name: string,
  attributes: Record<string, unknown> = {},
  custom: Record<string, unknown> | null = { user_id: USER },
) => ({
  meta: { event_name: name, custom_data: custom },
  data: {
    id: "sub_77",
    type: "subscriptions",
    attributes: {
      status: "active",
      cancelled: false,
      customer_id: 555,
      renews_at: "2030-02-01T00:00:00.000Z",
      ends_at: null,
      updated_at: "2030-01-01T00:00:00.000Z",
      ...attributes,
    },
  },
});

function spies(existing: unknown = null) {
  vi.spyOn(Subscription, "findOne").mockReturnValue(chain(existing) as never);
  const upsert = vi.spyOn(Subscription, "findOneAndUpdate").mockResolvedValue({} as never);
  const user = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
  return { upsert, user };
}

const plusUntilOf = (user: ReturnType<typeof spies>["user"]) =>
  (user.mock.calls[0] as unknown as [unknown, { $set: { plusUntil: Date } }])[1].$set.plusUntil;

describe("subscription webhooks", () => {
  it("activates Plus until the renewal date plus a grace period", async () => {
    const { upsert, user } = spies();
    const res = await send(subscriptionEvent("subscription_created"));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      { providerSubscriptionId: "sub_77" },
      { $set: expect.objectContaining({ user: USER, provider: "lemonsqueezy", status: "active" }) },
      { upsert: true },
    );
    expect(user).toHaveBeenCalledWith({ _id: USER }, expect.anything());
    expect(plusUntilOf(user).getTime()).toBe(Date.parse("2030-02-01T00:00:00Z") + RENEWAL_GRACE_MS);
  });

  it("keeps access to the end of the period after a cancellation", async () => {
    const { user } = spies();
    await send(
      subscriptionEvent("subscription_cancelled", {
        status: "cancelled",
        cancelled: true,
        ends_at: "2030-02-01T00:00:00.000Z",
      }),
    );
    expect(plusUntilOf(user).getTime()).toBe(Date.parse("2030-02-01T00:00:00Z"));
  });

  it("removes access when the subscription expires", async () => {
    const { user } = spies();
    const before = Date.now();
    await send(subscriptionEvent("subscription_expired", { status: "expired" }));
    expect(plusUntilOf(user).getTime()).toBeGreaterThanOrEqual(before);
    expect(plusUntilOf(user).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("ignores a snapshot older than the one already stored", async () => {
    const { upsert, user } = spies({ providerUpdatedAt: new Date("2031-01-01T00:00:00Z") });
    const res = await send(subscriptionEvent("subscription_updated"));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(user).not.toHaveBeenCalled();
  });

  it("does nothing for a subscription with no user id, but still answers 200", async () => {
    const { upsert, user } = spies();
    const res = await send(subscriptionEvent("subscription_created", {}, null));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(user).not.toHaveBeenCalled();
  });

  it("ignores subscription payment (invoice) events", async () => {
    const { upsert, user } = spies();
    const payload = subscriptionEvent("subscription_payment_success");
    payload.data.type = "subscription-invoices";
    expect((await send(payload)).status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(user).not.toHaveBeenCalled();
  });
});

describe("Plus checkout and portal with Lemon Squeezy", () => {
  it("creates a checkout for the Plus variant, tied to the user", async () => {
    vi.spyOn(User, "findById").mockReturnValue(chain({ email: "sam@example.com", plusUntil: null }) as never);
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null) as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { attributes: { url: "https://shop.lemonsqueezy.com/checkout/plus" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/api/billing/checkout").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://shop.lemonsqueezy.com/checkout/plus");

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as {
      data: {
        attributes: { custom_price?: number; checkout_data: { custom: Record<string, string> } };
        relationships: { variant: { data: { id: string } } };
      };
    };
    expect(body.data.relationships.variant.data.id).toBe("333");
    expect(body.data.attributes.custom_price).toBeUndefined();
    expect(body.data.attributes.checkout_data.custom).toEqual({ user_id: USER, plan: "plus" });
  });

  it("returns a fresh customer portal link", async () => {
    vi.spyOn(Subscription, "findOne").mockReturnValue(
      chain({ provider: "lemonsqueezy", providerSubscriptionId: "sub_77" }) as never,
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { attributes: { urls: { customer_portal: "https://portal.example/x" } } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/api/billing/portal").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://portal.example/x");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://api.lemonsqueezy.com/v1/subscriptions/sub_77",
    );
  });

  it("returns 502 without leaking provider details when checkout fails", async () => {
    vi.spyOn(User, "findById").mockReturnValue(chain({ email: "a@b.co", plusUntil: null }) as never);
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null) as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "secret" }));
    const res = await request(app).post("/api/billing/checkout").set(auth);
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
