import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Comment } from "../models/Comment.js";
import { Community } from "../models/Community.js";
import { Conversation } from "../models/Conversation.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Membership } from "../models/Membership.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";
import { Purchase } from "../models/Purchase.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { AuthToken } from "../models/AuthToken.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { removePost } from "../services/moderationService.js";
import { signAccessToken } from "../utils/tokens.js";
import { call } from "./helpers.js";

vi.mock("../services/moderationService.js", () => ({
  removePost: vi.fn().mockResolvedValue(undefined),
}));

const app = createApp();
const USER_ID = "507f1f77bcf86cd799439011";
const token = signAccessToken(USER_ID);
const oid = (s: string) => new mongoose.Types.ObjectId(s);

/** A query stand-in: every chained call returns itself and awaiting it gives `result`. */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "sort", "limit", "populate", "lean"]) q[m] = () => q;
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q as never;
}

function mockAccount(extra: Record<string, unknown> = {}) {
  const account = {
    _id: oid(USER_ID),
    username: "Alice",
    email: "alice@example.com",
    role: "user",
    banned: false,
    passwordHash: bcrypt.hashSync("correct-horse", 4),
    ...extra,
  };
  vi.spyOn(User, "findById").mockImplementation((() => chain(account)) as never);
  return account;
}

function mockEverythingElse() {
  vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null));
  vi.spyOn(Post, "find").mockReturnValue(chain([]));
  vi.spyOn(Comment, "aggregate").mockResolvedValue([] as never);
  vi.spyOn(Comment, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Like, "find").mockReturnValue(chain([]));
  vi.spyOn(Like, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Membership, "find").mockReturnValue(chain([]));
  vi.spyOn(Membership, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Community, "updateMany").mockResolvedValue({} as never);
  vi.spyOn(Follow, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Notification, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(PostView, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Conversation, "find").mockReturnValue(chain([]));
  vi.spyOn(Message, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(Conversation, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(PushSubscription, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(RefreshToken, "deleteMany").mockResolvedValue({} as never);
  vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({} as never);
  return vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("delete account input", () => {
  it("needs the username typed in", () => {
    expect(deleteAccountSchema.safeParse({ confirm: "  " }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirm: "alice" }).success).toBe(true);
  });
});

describe("account data routes", () => {
  it("require a login", async () => {
    expect((await call(app, "get", "/api/users/me/export")).status).toBe(401);
    expect((await call(app, "delete", "/api/users/me")).status).toBe(401);
  });
});

describe("GET /api/users/me/export", () => {
  beforeEach(() => {
    mockAccount();
    vi.spyOn(Post, "find").mockReturnValue(
      chain([{ _id: oid("507f1f77bcf86cd799439021"), content: "hello", premiumContent: "secret" }]),
    );
    vi.spyOn(Comment, "find").mockReturnValue(chain([]));
    vi.spyOn(Like, "find").mockReturnValue(chain([]));
    vi.spyOn(Follow, "find").mockReturnValue(chain([]));
    vi.spyOn(Membership, "find").mockReturnValue(chain([]));
    vi.spyOn(Purchase, "find").mockReturnValue(chain([]));
    vi.spyOn(Subscription, "findOne").mockReturnValue(chain(null));
    vi.spyOn(Conversation, "find").mockReturnValue(chain([]));
    vi.spyOn(Message, "find").mockReturnValue(chain([]));
    vi.spyOn(User, "find").mockReturnValue(chain([]));
  });

  it("returns the person's own data as a download and never a password hash", async () => {
    const res = await call(app, "get", "/api/users/me/export", token);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.account.username).toBe("Alice");
    expect(res.body.posts[0].premiumContent).toBe("secret");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe("DELETE /api/users/me", () => {
  it("rejects a wrong confirmation", async () => {
    mockAccount();
    mockEverythingElse();
    const res = await call(app, "delete", "/api/users/me", token).send({
      confirm: "someone-else",
      password: "correct-horse",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong password", async () => {
    mockAccount();
    const update = mockEverythingElse();
    const res = await call(app, "delete", "/api/users/me", token).send({
      confirm: "alice",
      password: "wrong",
    });
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("asks a password account for its password", async () => {
    mockAccount();
    mockEverythingElse();
    const res = await call(app, "delete", "/api/users/me", token).send({ confirm: "alice" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it("does not delete an admin account", async () => {
    mockAccount({ role: "admin" });
    const update = mockEverythingElse();
    const res = await call(app, "delete", "/api/users/me", token).send({
      confirm: "alice",
      password: "correct-horse",
    });
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("asks to cancel an active Plus subscription first", async () => {
    mockAccount();
    const update = mockEverythingElse();
    vi.spyOn(Subscription, "findOne").mockReturnValue(
      chain({ provider: "lemonsqueezy", status: "active", cancelled: false }),
    );
    const res = await call(app, "delete", "/api/users/me", token).send({
      confirm: "alice",
      password: "correct-horse",
    });
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("erases the account and keeps posts other people bought", async () => {
    mockAccount();
    const update = mockEverythingElse();
    const bought = oid("507f1f77bcf86cd799439031");
    const free = oid("507f1f77bcf86cd799439032");
    vi.spyOn(Post, "find").mockReturnValue(chain([{ _id: bought }, { _id: free }]));
    vi.spyOn(Purchase, "countDocuments").mockImplementation(((q: {
      post: mongoose.Types.ObjectId;
    }) => Promise.resolve(String(q.post) === String(bought) ? 1 : 0)) as never);
    const removed = vi.mocked(removePost).mockClear();

    const res = await call(app, "delete", "/api/users/me", token).send({
      confirm: "ALICE",
      password: "correct-horse",
    });

    expect(res.status).toBe(204);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith(String(free));
    const [filter, change] = update.mock.calls[0] as unknown as [
      { _id: mongoose.Types.ObjectId },
      { $set: Record<string, unknown>; $unset: Record<string, unknown> },
    ];
    expect(String(filter._id)).toBe(USER_ID);
    expect(change.$set.username).toBe(`deleted_${USER_ID.slice(-8)}`);
    expect(change.$set.email).toBe(`deleted-${USER_ID}@deleted.invalid`);
    expect(change.$set.banned).toBe(true);
    expect(change.$set.bio).toBe("");
    expect(change.$unset).toEqual({ googleId: 1 });
    expect([res.headers["set-cookie"] ?? ""].flat().join(";")).toMatch(/commune_rt=;/);
  });

  it("lets a Google-only account delete itself without a password", async () => {
    mockAccount({ googleId: "g-123" });
    mockEverythingElse();
    const res = await call(app, "delete", "/api/users/me", token).send({ confirm: "alice" });
    expect(res.status).toBe(204);
  });
});
