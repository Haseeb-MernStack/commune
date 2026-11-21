import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { clip, esc } from "../controllers/shareController.js";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

function postChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.populate = vi.fn(() => chain);
  chain.collation = vi.fn(() => chain);
  chain.lean = () => Promise.resolve(result);
  return chain;
}

describe("share helpers", () => {
  it("escapes html and clips long text", () => {
    expect(esc(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
    expect(clip("a  b\n c", 50)).toBe("a b c");
    expect(clip("x".repeat(300), 10)).toHaveLength(10);
  });
});

describe("GET /api/share/post/:id", () => {
  const id = new mongoose.Types.ObjectId().toString();

  it("returns preview tags for a free post without logging in", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(
      postChain({
        content: "Hello <b>world</b>",
        imageUrl: null,
        priceCents: null,
        author: { username: "sam", banned: false },
      }) as never,
    );
    const res = await request(app).get(`/api/share/post/${id}`);
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain('property="og:title" content="sam on Commune"');
    expect(res.text).toContain("Hello &lt;b&gt;world&lt;/b&gt;");
    expect(res.text).not.toContain("<b>world</b>");
    expect(res.text).toContain("og:image");
  });

  it("never reveals the text of a paid post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(
      postChain({
        content: "secret teaser",
        imageUrl: "https://res.cloudinary.com/x/secret.jpg",
        priceCents: 500,
        author: { username: "sam" },
      }) as never,
    );
    const res = await request(app).get(`/api/share/post/${id}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("secret");
    expect(res.text).toContain("A paid post on Commune");
  });

  it("answers with the generic page for a missing post, a banned author or a bad id", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(postChain(null) as never);
    const missing = await request(app).get(`/api/share/post/${id}`);
    expect(missing.status).toBe(404);
    expect(missing.text).toContain("open source community platform");

    vi.spyOn(Post, "findById").mockReturnValue(
      postChain({
        content: "hi",
        priceCents: null,
        author: { username: "bad", banned: true },
      }) as never,
    );
    const banned = await request(app).get(`/api/share/post/${id}`);
    expect(banned.status).toBe(404);
    expect(banned.text).not.toContain("bad on Commune");

    expect((await request(app).get("/api/share/post/not-an-id")).status).toBe(404);
  });
});

describe("GET /api/share/user/:username", () => {
  it("uses the bio and avatar of an active user", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(
      postChain({
        username: "sam",
        bio: "Builds things",
        avatarUrl: "https://res.cloudinary.com/x/a.jpg",
        banned: false,
      }) as never,
    );
    const res = await request(app).get("/api/share/user/sam");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Builds things");
    expect(res.text).toContain("https://res.cloudinary.com/x/a.jpg");
    expect(res.text).toContain("/u/sam");
  });

  it("does not describe a banned or unknown user", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(
      postChain({ username: "bad", bio: "x", banned: true }) as never,
    );
    const res = await request(app).get("/api/share/user/bad");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("bad on Commune");
  });
});
