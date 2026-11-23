import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { followListQuerySchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";
import { call } from "./helpers.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = "507f1f77bcf86cd799439011";
const token = signAccessToken(ME);

afterEach(() => vi.restoreAllMocks());

/** A query object whose chained methods all return itself and whose lean() gives `value`. */
function chain(value: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["sort", "limit", "select", "collation"]) q[m] = vi.fn(() => q);
  q.lean = () => Promise.resolve(value);
  return q;
}

interface Setup {
  /** Follow records for the page, newest first. */
  rows: {
    _id: mongoose.Types.ObjectId;
    follower: mongoose.Types.ObjectId;
    following: mongoose.Types.ObjectId;
  }[];
  users: { _id: mongoose.Types.ObjectId; username: string; bio?: string; banned?: boolean }[];
  iFollow?: mongoose.Types.ObjectId[];
  followMe?: mongoose.Types.ObjectId[];
  /** The person whose lists are opened keeps them private. */
  hidden?: boolean;
  /** The viewer is that person. */
  owner?: boolean;
  viewerRole?: "user" | "admin";
}

function setup({
  rows,
  users,
  iFollow = [],
  followMe = [],
  hidden = false,
  owner = false,
  viewerRole = "user",
}: Setup) {
  const target = {
    _id: owner ? new mongoose.Types.ObjectId(ME) : oid(),
    username: "sam",
    hideConnections: hidden,
  };
  const asUser = (u: Setup["users"][number]) => ({ ...u, avatarUrl: null, plusUntil: null });
  vi.spyOn(User, "findOne").mockReturnValue(chain(target) as never);
  // requireActive and the page lookup both read users; the page lookup is the one with `$in`.
  vi.spyOn(User, "findById").mockImplementation((() =>
    chain({ role: viewerRole, banned: false })) as never);
  const userFind = vi
    .spyOn(User, "find")
    .mockImplementation(((filter: { banned?: unknown }) =>
      chain(users.filter((u) => filter.banned === undefined || !u.banned).map(asUser))) as never);
  const followFind = vi.spyOn(Follow, "find").mockImplementation(((
    filter: Record<string, unknown>,
  ) => {
    const f = filter.following as { $in?: unknown } | undefined;
    const g = filter.follower as { $in?: unknown } | undefined;
    if (f?.$in) return chain(iFollow.map((id) => ({ following: id })));
    if (g?.$in) return chain(followMe.map((id) => ({ follower: id })));
    return chain(rows);
  }) as never);
  return { target, userFind, followFind };
}

describe("followListQuerySchema", () => {
  it("defaults to 20 and caps at 50", () => {
    expect(followListQuerySchema.parse({}).limit).toBe(20);
    expect(followListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
});

describe("GET /api/users/:username/followers and /following", () => {
  it("requires a login", async () => {
    expect((await call(app, "get", "/api/users/sam/followers")).status).toBe(401);
    expect((await call(app, "get", "/api/users/sam/following")).status).toBe(401);
  });

  it("rejects a cursor that is not a valid id", async () => {
    setup({ rows: [], users: [] });
    const res = await call(app, "get", "/api/users/sam/followers?cursor=nope", token);
    expect(res.status).toBe(400);
  });

  it("lists followers with the viewer's relationship to each person", async () => {
    const a = oid();
    const b = oid();
    const target = oid();
    setup({
      rows: [
        { _id: oid(), follower: a, following: target },
        { _id: oid(), follower: b, following: target },
      ],
      users: [
        { _id: a, username: "alice", bio: "hi" },
        { _id: b, username: "bob" },
      ],
      iFollow: [a],
      followMe: [b],
    });
    const res = await call(app, "get", "/api/users/sam/followers", token);
    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items).toEqual([
      expect.objectContaining({
        username: "alice",
        bio: "hi",
        followedByMe: true,
        followsYou: false,
      }),
      expect.objectContaining({ username: "bob", followedByMe: false, followsYou: true }),
    ]);
  });

  it("never returns private or internal fields", async () => {
    const a = oid();
    setup({
      rows: [{ _id: oid(), follower: oid(), following: a }],
      users: [{ _id: a, username: "alice" }],
    });
    const res = await call(app, "get", "/api/users/sam/following", token);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ["avatarUrl", "bio", "followedByMe", "followsYou", "id", "plus", "username"].sort(),
    );
  });

  it("leaves out banned accounts but keeps the page cursor", async () => {
    const a = oid();
    const b = oid();
    const rows = [
      { _id: oid(), follower: a, following: oid() },
      { _id: oid(), follower: b, following: oid() },
    ];
    setup({
      rows,
      users: [
        { _id: a, username: "alice", banned: true },
        { _id: b, username: "bob" },
      ],
    });
    const res = await call(app, "get", "/api/users/sam/followers?limit=1", token);
    expect(res.status).toBe(200);
    // One record fits the page and the second proves there is more, so a cursor is returned
    // even though the only person on this page is banned and therefore hidden.
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBe(rows[0]!._id.toString());
  });

  it("asks for one extra record to know whether there is another page", async () => {
    const { followFind } = setup({ rows: [], users: [] });
    await call(app, "get", "/api/users/sam/followers?limit=5", token);
    const rowQuery = followFind.mock.results[0]!.value as { limit: ReturnType<typeof vi.fn> };
    expect(rowQuery.limit).toHaveBeenCalledWith(6);
  });
});

describe("private followers and following lists", () => {
  const hiddenWith = (extra: Partial<Setup> = {}) =>
    setup({
      rows: [{ _id: oid(), follower: oid(), following: oid() }],
      users: [],
      hidden: true,
      ...extra,
    });

  it("refuses other people, for both lists, without reading any records", async () => {
    const { followFind } = hiddenWith();
    for (const list of ["followers", "following"]) {
      const res = await call(app, "get", `/api/users/sam/${list}`, token);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/alice|items/);
    }
    expect(followFind).not.toHaveBeenCalled();
  });

  it("still lets the owner read their own lists", async () => {
    hiddenWith({ owner: true });
    expect((await call(app, "get", "/api/users/sam/followers", token)).status).toBe(200);
  });

  it("lets an admin read them for moderation", async () => {
    hiddenWith({ viewerRole: "admin" });
    expect((await call(app, "get", "/api/users/sam/following", token)).status).toBe(200);
  });

  it("is public again when the setting is off", async () => {
    setup({ rows: [], users: [], hidden: false });
    expect((await call(app, "get", "/api/users/sam/followers", token)).status).toBe(200);
  });
});

describe("GET and PATCH /api/users/me/privacy", () => {
  it("requires a login", async () => {
    expect((await call(app, "get", "/api/users/me/privacy")).status).toBe(401);
    expect((await call(app, "patch", "/api/users/me/privacy").send({})).status).toBe(401);
  });

  it("reads the saved choice, defaulting to public", async () => {
    vi.spyOn(User, "findById").mockImplementation((() =>
      chain({ hideConnections: undefined })) as never);
    const res = await call(app, "get", "/api/users/me/privacy", token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hideConnections: false });
  });

  it("only accepts a true or false value", async () => {
    vi.spyOn(User, "findById").mockImplementation((() =>
      chain({ role: "user", banned: false })) as never);
    for (const bad of [{}, { hideConnections: "yes" }, { hideConnections: 1 }]) {
      const res = await call(app, "patch", "/api/users/me/privacy", token).send(bad);
      expect(res.status).toBe(400);
    }
  });

  it("saves the choice for the signed-in person only", async () => {
    vi.spyOn(User, "findById").mockImplementation((() =>
      chain({ role: "user", banned: false })) as never);
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    const res = await call(app, "patch", "/api/users/me/privacy", token).send({
      hideConnections: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hideConnections: true });
    expect(update).toHaveBeenCalledWith({ _id: ME }, { $set: { hideConnections: true } });
  });
});
