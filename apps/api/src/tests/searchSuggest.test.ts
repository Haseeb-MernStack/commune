import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { signAccessToken } from "../utils/tokens.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { Like } from "../models/Like.js";
import { Bookmark } from "../models/Bookmark.js";
import { Purchase } from "../models/Purchase.js";

vi.mock("../models/User.js", () => ({ User: { find: vi.fn() } }));
vi.mock("../models/Post.js", () => ({ Post: { find: vi.fn() } }));
vi.mock("../models/Like.js", () => ({ Like: { find: vi.fn() } }));
vi.mock("../models/Bookmark.js", () => ({ Bookmark: { find: vi.fn() } }));
vi.mock("../models/Purchase.js", () => ({ Purchase: { find: vi.fn() } }));

const ME = new Types.ObjectId().toString();
const token = signAccessToken(ME);

function queryChain<T>(rows: T[]) {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    populate: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(async () => rows),
  };
  return chain;
}

describe("GET /search/suggest", () => {
  it("returns up to 5 people and 3 posts matching the text", async () => {
    const userChain = queryChain([
      { _id: new Types.ObjectId(), username: "sam", bio: "Hi", avatarUrl: null, plusUntil: null },
    ]);
    const postChain = queryChain([
      {
        _id: new Types.ObjectId(),
        author: { _id: "a1", username: "sam", avatarUrl: null, plusUntil: null },
        community: { _id: "c1", slug: "photography", name: "Photography" },
        content: "hello world",
        priceCents: null,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date(),
      },
    ]);
    vi.mocked(User.find).mockReturnValue(userChain as never);
    vi.mocked(Post.find).mockReturnValue(postChain as never);
    vi.mocked(Like.find).mockReturnValue(queryChain([]) as never);
    vi.mocked(Bookmark.find).mockReturnValue(queryChain([]) as never);
    vi.mocked(Purchase.find).mockReturnValue(queryChain([]) as never);

    const res = await request(createApp())
      .get("/search/suggest?q=sa")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe("sam");
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].content).toBe("hello world");
    expect(User.find).toHaveBeenCalledWith({
      username: { $regex: "^sa", $options: "i" },
      banned: { $ne: true },
    });
    expect(Post.find).toHaveBeenCalledWith(
      { $text: { $search: "sa" } },
      { score: { $meta: "textScore" } },
    );
    expect(userChain.limit).toHaveBeenCalledWith(5);
    expect(postChain.limit).toHaveBeenCalledWith(3);
  });

  it("rejects queries shorter than 2 characters", async () => {
    const res = await request(createApp())
      .get("/search/suggest?q=a")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
