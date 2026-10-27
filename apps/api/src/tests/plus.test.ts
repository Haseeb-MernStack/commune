import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { lastDays } from "../controllers/insightsController.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";
import { Purchase } from "../models/Purchase.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { recordPurchase } from "../services/purchaseService.js";
import { isPlusActive, plusUntilFor, RENEWAL_GRACE_MS } from "../utils/plan.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = oid().toString();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };
const DAY = 24 * 60 * 60 * 1000;
const future = () => new Date(Date.now() + 10 * DAY);
const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

/** Makes every User.findById(...).select(...).lean() return this user. */
const asUser = (user: Record<string, unknown>) =>
  vi.spyOn(User, "findById").mockReturnValue(chain({ role: "user", banned: false, ...user }) as never);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("plan rules", () => {
  const now = Date.parse("2030-01-10T00:00:00Z");
  const base = { status: "active", cancelled: false, renewsAt: new Date("2030-02-01T00:00:00Z"), endsAt: null };

  it("keeps access through the renewal date plus a grace period", () => {
    expect(plusUntilFor(base, now).getTime()).toBe(base.renewsAt.getTime() + RENEWAL_GRACE_MS);
  });

  it("lets a cancelled subscription run to the end of the paid period, then stops", () => {
    const endsAt = new Date("2030-02-01T00:00:00Z");
    expect(plusUntilFor({ ...base, cancelled: true, endsAt }, now)).toEqual(endsAt);
    expect(plusUntilFor({ ...base, status: "cancelled", cancelled: true, endsAt }, now)).toEqual(endsAt);
  });

  it("gives no access when expired, paused, unpaid or unknown", () => {
    for (const status of ["expired", "paused", "unpaid", "something_new"]) {
      expect(plusUntilFor({ ...base, status }, now).getTime()).toBe(now);
    }
  });

  it("gives a failed renewal only the grace period", () => {
    const renewsAt = new Date(now - 1 * DAY);
    expect(plusUntilFor({ ...base, status: "past_due", renewsAt }, now).getTime()).toBe(
      renewsAt.getTime() + RENEWAL_GRACE_MS,
    );
  });

  it("isPlusActive compares against the clock", () => {
    expect(isPlusActive(null)).toBe(false);
    expect(isPlusActive(new Date(Date.now() - 1000))).toBe(false);
    expect(isPlusActive(future())).toBe(true);
  });
});

describe("billing (simulated payments in development)", () => {
  it("GET /api/billing reports the plan", async () => {
    asUser({ plusUntil: future() });
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain({ status: "active", cancelled: false }) as never);
    const res = await request(app).get("/api/billing").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plus: true, cancelled: false, status: "active", available: true });
    expect(res.body.priceLabel).toBe("$5 / month");
  });

  it("requires a login", async () => {
    expect((await request(app).get("/api/billing")).status).toBe(401);
    expect((await request(app).post("/api/billing/checkout")).status).toBe(401);
  });

  it("refuses a second subscription while one is active", async () => {
    asUser({ email: "a@b.co", plusUntil: future() });
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain({ cancelled: false }) as never);
    const res = await request(app).post("/api/billing/checkout").set(auth);
    expect(res.status).toBe(409);
  });

  it("activates Plus for 30 days in simulation", async () => {
    asUser({ email: "a@b.co", plusUntil: null });
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null) as never);
    vi.spyOn(Subscription, "findOneAndUpdate").mockResolvedValue({} as never);
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

    const res = await request(app).post("/api/billing/checkout").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("http://localhost:5173/plus?welcome=1");
    const args = update.mock.calls[0] as unknown as [unknown, { $set: { plusUntil: Date } }];
    expect(args[1].$set.plusUntil.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it("POST /api/billing/portal needs a subscription", async () => {
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null) as never);
    const res = await request(app).post("/api/billing/portal").set(auth);
    expect(res.status).toBe(400);
  });
});

describe("Plus features", () => {
  const row = (author: Record<string, unknown>, content: string) => ({
    _id: oid(),
    content,
    imageUrl: null,
    author,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date(),
  });
  const longText = "x".repeat(600);

  it("blocks long posts for free accounts", async () => {
    asUser({ plusUntil: null });
    const create = vi.spyOn(Post, "create");
    const res = await request(app).post("/api/posts").set(auth).send({ content: longText });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Plus/);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows long posts for Plus members and marks the author", async () => {
    asUser({ plusUntil: future() });
    const author = { _id: oid(), username: "sam", avatarUrl: null, plusUntil: future() };
    vi.spyOn(Post, "create").mockResolvedValue({ _id: oid() } as never);
    vi.spyOn(Post, "findById").mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve(row(author, longText)) }) }),
    } as never);
    const res = await request(app).post("/api/posts").set(auth).send({ content: longText });
    expect(res.status).toBe(201);
    expect(res.body.author.plus).toBe(true);
  });

  it("still rejects posts over the Plus limit", async () => {
    asUser({ plusUntil: future() });
    const res = await request(app).post("/api/posts").set(auth).send({ content: "x".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("charges Plus creators the lower platform fee", async () => {
    asUser({ plusUntil: future() });
    const create = vi.spyOn(Purchase, "create").mockResolvedValue({} as never);
    await recordPurchase({
      userId: oid().toString(),
      postId: oid().toString(),
      creatorId: oid().toString(),
      amountCents: 1000,
      currency: "USD",
      provider: "lemonsqueezy",
      orderId: "o1",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ feeCents: 100, creatorShareCents: 900 }),
    );
  });
});

describe("GET /api/insights", () => {
  it("is for Plus members only", async () => {
    asUser({ plusUntil: null });
    expect((await request(app).get("/api/insights").set(auth)).status).toBe(403);
    expect((await request(app).get("/api/insights")).status).toBe(401);
  });

  it("returns totals, a 30-day series and top posts", async () => {
    asUser({ plusUntil: future() });
    const today = lastDays().at(-1)!;
    vi.spyOn(Post, "aggregate").mockResolvedValue([{ posts: 3, views: 10, likes: 4, comments: 2 }] as never);
    vi.spyOn(PostView, "aggregate").mockResolvedValue([{ _id: today, views: 5 }] as never);
    vi.spyOn(Follow, "countDocuments").mockResolvedValueOnce(7 as never).mockResolvedValueOnce(2 as never);
    vi.spyOn(Post, "find").mockReturnValue({
      sort: () => ({
        limit: () => ({
          select: () => ({
            lean: () =>
              Promise.resolve([
                { _id: oid(), content: "Top post", viewCount: 9, likeCount: 3, commentCount: 1, createdAt: new Date() },
              ]),
          }),
        }),
      }),
    } as never);

    const res = await request(app).get("/api/insights").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      posts: 3,
      views: 10,
      likes: 4,
      comments: 2,
      followers: 7,
      newFollowers30d: 2,
    });
    expect(res.body.daily).toHaveLength(30);
    expect(res.body.daily.at(-1)).toEqual({ day: today, views: 5 });
    expect(res.body.daily[0].views).toBe(0);
    expect(res.body.topPosts[0]).toMatchObject({ content: "Top post", views: 9, likes: 3 });
  });

  it("lastDays ends today and has no gaps", () => {
    const days = lastDays(Date.parse("2030-03-01T12:00:00Z"));
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toBe("2030-03-01");
    expect(days[0]).toBe("2030-01-31");
  });
});

describe("POST /api/posts/:id/view", () => {
  const postId = oid().toString();

  it("does not count the author's own views", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: ME }) as never);
    const upsert = vi.spyOn(PostView, "updateOne");
    const res = await request(app).post(`/api/posts/${postId}/view`).set(auth);
    expect(res.status).toBe(204);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("counts a new viewer once and ignores repeats the same day", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: oid() }) as never);
    const inc = vi.spyOn(Post, "updateOne").mockResolvedValue({} as never);
    const upsert = vi.spyOn(PostView, "updateOne").mockResolvedValue({ upsertedCount: 1 } as never);
    expect((await request(app).post(`/api/posts/${postId}/view`).set(auth)).status).toBe(204);
    expect(inc).toHaveBeenCalledWith({ _id: postId }, { $inc: { viewCount: 1 } });

    inc.mockClear();
    upsert.mockResolvedValue({ upsertedCount: 0 } as never);
    expect((await request(app).post(`/api/posts/${postId}/view`).set(auth)).status).toBe(204);
    expect(inc).not.toHaveBeenCalled();
  });
});
