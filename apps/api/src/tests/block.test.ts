import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setBlockSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Block } from "../models/Block.js";
import { Comment } from "../models/Comment.js";
import { Conversation } from "../models/Conversation.js";
import { Follow } from "../models/Follow.js";
import { Bookmark } from "../models/Bookmark.js";
import { Like } from "../models/Like.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { BLOCKED_MESSAGE } from "../services/blockService.js";
import { notify } from "../services/notificationService.js";
import { signAccessToken } from "../utils/tokens.js";
import { call } from "./helpers.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = "507f1f77bcf86cd799439011";
const OTHER = oid();
const THIRD = oid();
const POST = oid().toString();
const CONVO = oid().toString();
const token = signAccessToken(ME);

afterEach(() => vi.restoreAllMocks());

/** A query stand-in: every chained call returns itself and lean() gives `value`. */
function chain(value: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "sort", "limit", "populate"]) q[m] = () => q;
  q.lean = () => Promise.resolve(value);
  return q as never;
}
const lookUp = (user: Record<string, unknown> = {}) =>
  vi.spyOn(User, "findOne").mockReturnValue({
    collation: () => chain({ _id: OTHER, username: "sam", banned: false, ...user }),
  } as never);
/** The other person has blocked me. */
const theyBlockedMe = () => vi.spyOn(Block, "exists").mockResolvedValue({ _id: oid() } as never);
const hiding = (...ids: mongoose.Types.ObjectId[]) =>
  vi.spyOn(Block, "find").mockReturnValue(chain(ids.map((blocked) => ({ blocked }))));

describe("setBlockSchema", () => {
  it("accepts mute and block only", () => {
    expect(setBlockSchema.safeParse({ kind: "mute" }).success).toBe(true);
    expect(setBlockSchema.safeParse({ kind: "block" }).success).toBe(true);
    expect(setBlockSchema.safeParse({ kind: "ban" }).success).toBe(false);
    expect(setBlockSchema.safeParse({}).success).toBe(false);
  });
});

describe("PUT and DELETE /api/users/:username/block", () => {
  it("require a login", async () => {
    expect((await call(app, "put", "/api/users/sam/block").send({ kind: "mute" })).status).toBe(
      401,
    );
    expect((await call(app, "delete", "/api/users/sam/block")).status).toBe(401);
  });

  it("refuses to mute or block yourself", async () => {
    lookUp({ _id: new mongoose.Types.ObjectId(ME) });
    const res = await call(app, "put", "/api/users/me2/block", token).send({ kind: "block" });
    expect(res.status).toBe(400);
  });

  it("a mute only stores the row", async () => {
    lookUp();
    const save = vi.spyOn(Block, "updateOne").mockResolvedValue({} as never);
    const unfollow = vi.spyOn(Follow, "deleteMany").mockResolvedValue({} as never);
    const res = await call(app, "put", "/api/users/sam/block", token).send({ kind: "mute" });
    expect(res.status).toBe(204);
    expect(save).toHaveBeenCalledWith(
      { blocker: ME, blocked: OTHER },
      { $set: { kind: "mute" } },
      { upsert: true },
    );
    expect(unfollow).not.toHaveBeenCalled();
  });

  it("a block also removes follows in both directions", async () => {
    lookUp();
    vi.spyOn(Block, "updateOne").mockResolvedValue({} as never);
    const unfollow = vi.spyOn(Follow, "deleteMany").mockResolvedValue({} as never);
    expect(
      (await call(app, "put", "/api/users/sam/block", token).send({ kind: "block" })).status,
    ).toBe(204);
    expect(unfollow).toHaveBeenCalledWith({
      $or: [
        { follower: ME, following: OTHER },
        { follower: OTHER, following: ME },
      ],
    });
  });

  it("DELETE unmutes or unblocks", async () => {
    lookUp();
    const del = vi.spyOn(Block, "deleteOne").mockResolvedValue({} as never);
    expect((await call(app, "delete", "/api/users/sam/block", token)).status).toBe(204);
    expect(del).toHaveBeenCalledWith({ blocker: ME, blocked: OTHER });
  });
});

describe("GET /api/users/me/blocks", () => {
  it("lists who I muted or blocked", async () => {
    vi.spyOn(Block, "find").mockReturnValue(
      chain([
        {
          kind: "mute",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          blocked: { _id: OTHER, username: "sam", avatarUrl: null },
        },
        { kind: "block", createdAt: new Date(), blocked: null }, // deleted account: skipped
      ]),
    );
    const res = await call(app, "get", "/api/users/me/blocks", token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: OTHER.toString(),
        username: "sam",
        avatarUrl: null,
        kind: "mute",
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("feeds, search and notifications hide muted and blocked people", () => {
  it("the main feed excludes them", async () => {
    hiding(OTHER);
    const find = vi.spyOn(Post, "find").mockReturnValue(chain([]));
    vi.spyOn(Like, "find").mockReturnValue(chain([]));
    vi.spyOn(Bookmark, "find").mockReturnValue(chain([]));
    expect((await call(app, "get", "/api/posts", token)).status).toBe(200);
    expect(find).toHaveBeenCalledWith({ author: { $nin: [OTHER] } });
  });

  it("the following feed drops them from the list of authors", async () => {
    hiding(OTHER);
    vi.spyOn(Follow, "find").mockReturnValue(chain([{ following: OTHER }, { following: THIRD }]));
    const find = vi.spyOn(Post, "find").mockReturnValue(chain([]));
    vi.spyOn(Like, "find").mockReturnValue(chain([]));
    vi.spyOn(Bookmark, "find").mockReturnValue(chain([]));
    await call(app, "get", "/api/posts?feed=following", token);
    expect(find).toHaveBeenCalledWith({ author: { $in: [THIRD, ME] } });
  });

  it("post search excludes them", async () => {
    hiding(OTHER);
    const find = vi.spyOn(Post, "find").mockReturnValue(chain([]));
    vi.spyOn(Like, "find").mockReturnValue(chain([]));
    vi.spyOn(Bookmark, "find").mockReturnValue(chain([]));
    await call(app, "get", "/api/search/posts?q=hello", token);
    expect(find).toHaveBeenCalledWith(
      { $text: { $search: "hello" }, author: { $nin: [OTHER] } },
      { score: { $meta: "textScore" } },
    );
  });

  it("people search excludes them", async () => {
    hiding(OTHER);
    const find = vi.spyOn(User, "find").mockReturnValue(chain([]));
    await call(app, "get", "/api/search/users?q=sa", token);
    expect(find).toHaveBeenCalledWith({
      username: { $regex: "^sa", $options: "i" },
      banned: { $ne: true },
      _id: { $nin: [OTHER] },
    });
  });

  it("notifications from them are left out", async () => {
    hiding(OTHER);
    const find = vi.spyOn(Notification, "find").mockReturnValue(chain([]));
    await call(app, "get", "/api/notifications", token);
    expect(find).toHaveBeenCalledWith({ user: ME, actor: { $nin: [OTHER] } });
  });

  it("no new notification is created from someone I muted or blocked", async () => {
    theyBlockedMe(); // Block.exists is also what notify() asks
    const upsert = vi.spyOn(Notification, "updateOne").mockResolvedValue({} as never);
    const create = vi.spyOn(Notification, "create").mockResolvedValue({} as never);
    await notify({ user: oid(), actor: ME, type: "like", post: POST });
    await notify({ user: oid(), actor: ME, type: "comment", post: POST });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("a blocked person cannot act, and cannot tell why", () => {
  it("follow", async () => {
    lookUp();
    theyBlockedMe();
    const create = vi.spyOn(Follow, "create");
    const res = await call(app, "post", "/api/users/sam/follow", token);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCKED_MESSAGE);
    expect(create).not.toHaveBeenCalled();
  });

  it("comment", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: OTHER }));
    theyBlockedMe();
    const create = vi.spyOn(Comment, "create");
    const res = await call(app, "post", `/api/posts/${POST}/comments`, token).send({
      content: "hi",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCKED_MESSAGE);
    expect(create).not.toHaveBeenCalled();
  });

  it("like", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: OTHER }));
    theyBlockedMe();
    const create = vi.spyOn(Like, "create");
    const res = await call(app, "post", `/api/posts/${POST}/like`, token);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCKED_MESSAGE);
    expect(create).not.toHaveBeenCalled();
  });

  it("starting a conversation", async () => {
    lookUp();
    vi.spyOn(Block, "find").mockReturnValue(chain([{ blocker: OTHER }]));
    const upsert = vi.spyOn(Conversation, "findOneAndUpdate");
    const res = await call(app, "post", "/api/messages/with/sam", token).send({ text: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCKED_MESSAGE);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("replying in an existing conversation", async () => {
    vi.spyOn(Conversation, "findById").mockReturnValue({
      lean: () =>
        Promise.resolve({ _id: CONVO, participants: [ME, OTHER], lastMessageAt: new Date() }),
    } as never);
    vi.spyOn(Block, "find").mockReturnValue(chain([{ blocker: OTHER }]));
    const create = vi.spyOn(Message, "create");
    const res = await call(app, "post", `/api/messages/${CONVO}`, token).send({ text: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCKED_MESSAGE);
    expect(create).not.toHaveBeenCalled();
  });

  it("the error text never mentions blocking", () => {
    expect(BLOCKED_MESSAGE).not.toMatch(/block|mute/i);
  });

  it("I am told how to fix it when I blocked them", async () => {
    lookUp();
    vi.spyOn(Block, "find").mockReturnValue(chain([{ blocker: new mongoose.Types.ObjectId(ME) }]));
    const res = await call(app, "post", "/api/messages/with/sam", token).send({ text: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unblock/i);
  });
});
