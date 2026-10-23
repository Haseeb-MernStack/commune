import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPostSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Post } from "../models/Post.js";
import { Purchase } from "../models/Purchase.js";
import { splitSale } from "../services/purchaseService.js";
import { toPostDTO } from "../utils/serializers.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const ME = new mongoose.Types.ObjectId().toString();
const OTHER = new mongoose.Types.ObjectId().toString();
const POST_ID = new mongoose.Types.ObjectId().toString();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };
const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

afterEach(() => {
  vi.restoreAllMocks();
});

const basePost = {
  _id: new mongoose.Types.ObjectId(),
  content: "Teaser",
  imageUrl: null,
  priceCents: 500,
  premiumContent: "The secret part",
  author: { _id: new mongoose.Types.ObjectId(), username: "sam", avatarUrl: null },
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date(),
};

describe("toPostDTO and paid content", () => {
  it("never includes premium content while locked", () => {
    const dto = toPostDTO(basePost, false, false);
    expect(dto.locked).toBe(true);
    expect(dto.premiumContent).toBeNull();
    expect(dto.priceCents).toBe(500);
    expect(JSON.stringify(dto)).not.toContain("The secret part");
  });

  it("includes it once unlocked", () => {
    const dto = toPostDTO(basePost, false, true);
    expect(dto.locked).toBe(false);
    expect(dto.premiumContent).toBe("The secret part");
  });

  it("leaves free posts alone", () => {
    const dto = toPostDTO({ ...basePost, priceCents: null, premiumContent: null }, false, false);
    expect(dto.locked).toBe(false);
    expect(dto.priceCents).toBeNull();
    expect(dto.premiumContent).toBeNull();
  });
});

describe("createPostSchema for paid posts", () => {
  it("accepts a price with premium content", () => {
    expect(
      createPostSchema.safeParse({ content: "Hi", priceCents: 500, premiumContent: "Secret" })
        .success,
    ).toBe(true);
  });

  it("requires premium content when a price is set, and a price when content is set", () => {
    expect(createPostSchema.safeParse({ content: "Hi", priceCents: 500 }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: "Hi", premiumContent: "Secret" }).success).toBe(
      false,
    );
  });

  it("enforces the price range and whole cents", () => {
    for (const priceCents of [99, 50001, 5.5]) {
      expect(
        createPostSchema.safeParse({ content: "Hi", priceCents, premiumContent: "x" }).success,
      ).toBe(false);
    }
  });
});

describe("splitSale", () => {
  it("keeps the platform fee and gives the rest to the creator", () => {
    expect(splitSale(1000, 20)).toEqual({ feeCents: 200, creatorShareCents: 800 });
    // Rounding never loses a cent: fee + share always equals the amount.
    const { feeCents, creatorShareCents } = splitSale(333, 20);
    expect(feeCents + creatorShareCents).toBe(333);
  });
});

describe("POST /api/posts/:id/checkout (mock mode)", () => {
  it("requires a login", async () => {
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`);
    expect(res.status).toBe(401);
  });

  it("rejects free posts", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: OTHER, priceCents: null }) as never);
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(400);
  });

  it("rejects buying your own post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: ME, priceCents: 500 }) as never);
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(400);
  });

  it("rejects a second purchase of the same post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: OTHER, priceCents: 500 }) as never);
    vi.spyOn(Purchase, "exists").mockResolvedValue({ _id: POST_ID } as never);
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(409);
  });

  it("records the sale with the platform fee and sends the buyer back to the post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: OTHER, priceCents: 1000 }) as never);
    vi.spyOn(Purchase, "exists").mockResolvedValue(null as never);
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    const res = await request(app).post(`/api/posts/${POST_ID}/checkout`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe(`http://localhost:5173/posts/${POST_ID}?unlocked=1`);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: ME,
        post: POST_ID,
        creator: OTHER,
        amountCents: 1000,
        feeCents: 200,
        creatorShareCents: 800,
        provider: "mock",
      }),
    );
  });
});

describe("webhook and earnings without Lemon Squeezy configured", () => {
  it("answers 503 to webhooks", async () => {
    const res = await request(app).post("/api/webhooks/lemonsqueezy").send({});
    expect(res.status).toBe(503);
  });

  it("GET /users/me/earnings requires a login", async () => {
    const res = await request(app).get("/api/users/me/earnings");
    expect(res.status).toBe(401);
  });

  it("GET /users/me/earnings returns zeros for a creator with no sales", async () => {
    vi.spyOn(Purchase, "aggregate").mockResolvedValue([] as never);
    const res = await request(app).get("/api/users/me/earnings").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currency: "USD", sales: 0, grossCents: 0, feeCents: 0, netCents: 0 });
  });
});
