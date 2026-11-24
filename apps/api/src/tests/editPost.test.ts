import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updatePostSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Bookmark } from "../models/Bookmark.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";
import { call } from "./helpers.js";

const app = createApp();
const ME = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439099";
const POST_ID = "507f1f77bcf86cd799439012";
const token = signAccessToken(ME);

afterEach(() => {
  vi.restoreAllMocks();
});

/** The account lookups made by requireActive and by the Plus check in updatePost. */
function mockAccount(plusUntil: Date | null = null) {
  vi.spyOn(User, "findById").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve({ role: "user", banned: false, plusUntil }) }),
  })) as never);
}

function mockStoredPost(author: string, content = "old text", imageUrl: string | null = null) {
  const authorId = new mongoose.Types.ObjectId(author);
  let calls = 0;
  vi.spyOn(Post, "findById").mockImplementation((() => {
    // First lookup: the stored post. Second (after saving): the post with its author filled in.
    const first = calls++ === 0;
    const row = first
      ? { _id: new mongoose.Types.ObjectId(POST_ID), author: authorId, content, imageUrl }
      : {
          _id: new mongoose.Types.ObjectId(POST_ID),
          author: { _id: authorId, username: "sam", createdAt: new Date() },
          content,
          imageUrl,
          likeCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          editedAt: new Date(),
        };
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.populate = () => chain;
    chain.lean = () => Promise.resolve(row);
    return chain;
  }) as never);
  vi.spyOn(Like, "find").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve([]) }),
  })) as never);
  vi.spyOn(Bookmark, "find").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve([]) }),
  })) as never);
}

describe("updatePostSchema", () => {
  it("trims the text and caps it at the longest allowed post", () => {
    expect(updatePostSchema.parse({ content: "  hi  " }).content).toBe("hi");
    expect(updatePostSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
    expect(updatePostSchema.safeParse({}).success).toBe(false);
  });
});

describe("PATCH /api/posts/:id", () => {
  it("requires a login", async () => {
    const res = await call(app, "patch", `/api/posts/${POST_ID}`).send({ content: "new" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    mockAccount();
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({ content: 5 });
    expect(res.status).toBe(400);
  });

  it("does not let someone edit another person's post", async () => {
    mockAccount();
    mockStoredPost(OTHER);
    const update = vi.spyOn(Post, "updateOne");
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({
      content: "mine now",
    });
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to empty a post that has no image", async () => {
    mockAccount();
    mockStoredPost(ME);
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({ content: "   " });
    expect(res.status).toBe(400);
  });

  it("needs Commune Plus for text over the free limit", async () => {
    mockAccount(null);
    mockStoredPost(ME);
    const update = vi.spyOn(Post, "updateOne");
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({
      content: "x".repeat(501),
    });
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("saves new text and marks the post as edited", async () => {
    mockAccount();
    mockStoredPost(ME);
    const update = vi.spyOn(Post, "updateOne").mockResolvedValue({} as never);
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({
      content: " better ",
    });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    const [filter, change] = update.mock.calls[0] as unknown as [
      { _id: string },
      { $set: { content: string; editedAt: Date } },
    ];
    expect(filter).toEqual({ _id: POST_ID });
    expect(change.$set.content).toBe("better");
    expect(change.$set.editedAt).toBeInstanceOf(Date);
    expect(res.body.editedAt).toEqual(expect.any(String));
  });

  it("does not mark a post as edited when the text is unchanged", async () => {
    mockAccount();
    mockStoredPost(ME, "same");
    const update = vi.spyOn(Post, "updateOne");
    const res = await call(app, "patch", `/api/posts/${POST_ID}`, token).send({ content: "same" });
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
