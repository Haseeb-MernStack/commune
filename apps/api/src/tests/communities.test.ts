import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommunitySchema, createPostSchema } from "@commune/shared";

// Removing a post touches many collections; here we only care that it was allowed.
vi.mock("../services/moderationService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/moderationService.js")>()),
  removePost: vi.fn().mockResolvedValue(undefined),
}));

import { createApp } from "../app.js";
import { Community } from "../models/Community.js";
import { Membership } from "../models/Membership.js";
import { Post } from "../models/Post.js";
import { removePost } from "../services/moderationService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = oid().toString();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };
const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

const community = () => ({
  _id: oid(),
  slug: "typescript",
  name: "TypeScript",
  description: "All things TS",
  memberCount: 3,
  createdAt: new Date(),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("community schemas", () => {
  it("normalises and validates slugs and names", () => {
    expect(createCommunitySchema.parse({ slug: "  TypeScript ", name: "TypeScript" }).slug).toBe(
      "typescript",
    );
    for (const slug of ["ab", "has space", "x".repeat(25), "bad-dash"]) {
      expect(createCommunitySchema.safeParse({ slug, name: "Valid name" }).success).toBe(false);
    }
    expect(createCommunitySchema.safeParse({ slug: "okay", name: "ab" }).success).toBe(false);
  });

  it("lets a post name a community", () => {
    expect(createPostSchema.parse({ content: "Hi", community: "TypeScript" }).community).toBe(
      "typescript",
    );
  });
});

describe("POST /api/communities", () => {
  const body = { slug: "typescript", name: "TypeScript", description: "All things TS" };

  it("requires a login and valid input", async () => {
    expect((await request(app).post("/api/communities").send(body)).status).toBe(401);
    const bad = await request(app).post("/api/communities").set(auth).send({ slug: "x", name: "y" });
    expect(bad.status).toBe(400);
  });

  it("creates the community and makes the creator its owner", async () => {
    vi.spyOn(Community, "countDocuments").mockResolvedValue(0 as never);
    const created = community();
    const create = vi.spyOn(Community, "create").mockResolvedValue(created as never);
    const member = vi.spyOn(Membership, "create").mockResolvedValue({} as never);

    const res = await request(app).post("/api/communities").set(auth).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slug: "typescript", joinedByMe: true, myRole: "owner" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "typescript", creator: ME, memberCount: 1 }),
    );
    expect(member).toHaveBeenCalledWith({ user: ME, community: created._id, role: "owner" });
  });

  it("answers 409 for a taken address and 403 past the per-user limit", async () => {
    vi.spyOn(Community, "countDocuments").mockResolvedValue(0 as never);
    vi.spyOn(Community, "create").mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    expect((await request(app).post("/api/communities").set(auth).send(body)).status).toBe(409);

    vi.spyOn(Community, "countDocuments").mockResolvedValue(5 as never);
    expect((await request(app).post("/api/communities").set(auth).send(body)).status).toBe(403);
  });
});

describe("GET /api/communities", () => {
  it("lists with my role, and searches with an escaped pattern", async () => {
    const c = community();
    vi.spyOn(Membership, "find").mockReturnValue(
      chain([{ community: c._id, role: "member" }]) as never,
    );
    const find = vi.spyOn(Community, "find").mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([c]) }) }),
    } as never);

    const res = await request(app).get("/api/communities?q=type.script").set(auth);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ slug: "typescript", joinedByMe: true, myRole: "member" });
    expect(find).toHaveBeenCalledWith({
      $or: [
        { slug: { $regex: "type\\.script", $options: "i" } },
        { name: { $regex: "type\\.script", $options: "i" } },
      ],
    });
  });
});

describe("joining and leaving", () => {
  it("404s for an unknown community", async () => {
    vi.spyOn(Community, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as never);
    expect((await request(app).post("/api/communities/nope/join").set(auth)).status).toBe(404);
  });

  it("joins and counts the new member once", async () => {
    const c = community();
    vi.spyOn(Community, "findOne").mockReturnValue({ lean: () => Promise.resolve(c) } as never);
    vi.spyOn(Membership, "create").mockResolvedValue({} as never);
    const update = vi.spyOn(Community, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/communities/typescript/join").set(auth);
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ _id: c._id }, { $inc: { memberCount: 1 } });
  });

  it("treats a repeated join as success without counting again", async () => {
    vi.spyOn(Community, "findOne").mockReturnValue({ lean: () => Promise.resolve(community()) } as never);
    vi.spyOn(Membership, "create").mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const update = vi.spyOn(Community, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/communities/typescript/join").set(auth);
    expect(res.status).toBe(204);
    expect(update).not.toHaveBeenCalled();
  });

  it("stops owners from leaving", async () => {
    vi.spyOn(Community, "findOne").mockReturnValue({ lean: () => Promise.resolve(community()) } as never);
    vi.spyOn(Membership, "findOne").mockReturnValue(chain({ role: "owner" }) as never);
    const res = await request(app).delete("/api/communities/typescript/join").set(auth);
    expect(res.status).toBe(400);
  });

  it("lets members leave and updates the count", async () => {
    const c = community();
    vi.spyOn(Community, "findOne").mockReturnValue({ lean: () => Promise.resolve(c) } as never);
    vi.spyOn(Membership, "findOne").mockReturnValue(chain({ role: "member" }) as never);
    vi.spyOn(Membership, "findOneAndDelete").mockResolvedValue({} as never);
    const update = vi.spyOn(Community, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).delete("/api/communities/typescript/join").set(auth);
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ _id: c._id }, { $inc: { memberCount: -1 } });
  });
});

describe("posting in a community", () => {
  it("is refused for non-members", async () => {
    vi.spyOn(Community, "findOne").mockReturnValue(chain({ _id: oid() }) as never);
    vi.spyOn(Membership, "exists").mockResolvedValue(null as never);
    const res = await request(app)
      .post("/api/posts")
      .set(auth)
      .send({ content: "Hello", community: "typescript" });
    expect(res.status).toBe(403);
  });

  it("404s for an unknown community", async () => {
    vi.spyOn(Community, "findOne").mockReturnValue(chain(null) as never);
    const res = await request(app)
      .post("/api/posts")
      .set(auth)
      .send({ content: "Hello", community: "nope" });
    expect(res.status).toBe(404);
  });
});

describe("deleting posts in a community", () => {
  const postId = oid().toString();

  it("lets the community owner remove someone else's post", async () => {
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: oid(), community: oid() }) as never);
    const exists = vi.spyOn(Membership, "exists").mockResolvedValue({ _id: oid() } as never);
    const res = await request(app).delete(`/api/posts/${postId}`).set(auth);
    expect(res.status).toBe(204);
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({ user: ME, role: "owner" }));
    expect(removePost).toHaveBeenCalled();
  });

  it("still refuses everyone else", async () => {
    vi.mocked(removePost).mockClear();
    vi.spyOn(Post, "findById").mockReturnValue(chain({ author: oid(), community: oid() }) as never);
    vi.spyOn(Membership, "exists").mockResolvedValue(null as never);
    const res = await request(app).delete(`/api/posts/${postId}`).set(auth);
    expect(res.status).toBe(403);
    expect(removePost).not.toHaveBeenCalled();
  });
});
