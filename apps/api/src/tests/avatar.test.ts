import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Nothing is deleted from storage in these tests; the calls are only observed.
vi.mock("../services/uploadService.js", async (original) => ({
  ...(await original<typeof import("../services/uploadService.js")>()),
  deleteUploadIfUnused: vi.fn().mockResolvedValue(undefined),
}));

import { createApp } from "../app.js";
import { QuotaLog } from "../models/QuotaLog.js";
import { User } from "../models/User.js";
import { AVATAR_CHANGES_PER_DAY, avatarAllowance } from "../services/avatarService.js";
import { imageTransform } from "../services/uploadService.js";
import { deleteUploadIfUnused } from "../services/uploadService.js";
import { DAY } from "../services/quota.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const USER_ID = "507f1f77bcf86cd799439011";
const auth = { Authorization: `Bearer ${signAccessToken(USER_ID)}` };
const photo = (n: number) => `/uploads/${String(n).repeat(32).slice(0, 32)}.webp`;

interface Row {
  _id: mongoose.Types.ObjectId;
  bucket: string;
  subject: string;
  createdAt: Date;
}
let rows: Row[] = [];
let current: { _id: string; avatarUrl: string | null; bio: string } | null = null;

beforeEach(() => {
  rows = [];
  current = { _id: USER_ID, avatarUrl: null, bio: "" };
  const match = (f: { bucket: string; subject: string; createdAt: { $gte: Date } }) =>
    rows.filter(
      (r) => r.bucket === f.bucket && r.subject === f.subject && r.createdAt >= f.createdAt.$gte,
    );
  vi.spyOn(QuotaLog, "insertMany").mockImplementation((async (
    docs: { bucket: string; subject: string }[],
  ) => {
    const made = docs.map((d) => ({
      _id: new mongoose.Types.ObjectId(),
      ...d,
      createdAt: new Date(),
    }));
    rows.push(...made);
    return made;
  }) as never);
  vi.spyOn(QuotaLog, "countDocuments").mockImplementation(
    (async (f: never) => match(f).length) as never,
  );
  vi.spyOn(QuotaLog, "findOne").mockImplementation(((f: never) => ({
    sort: () => ({
      select: () => ({
        lean: () =>
          Promise.resolve(
            [...match(f)].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())[0] ?? null,
          ),
      }),
    }),
  })) as never);
  vi.spyOn(QuotaLog, "deleteMany").mockImplementation((async (f: { _id: { $in: unknown[] } }) => {
    const ids = new Set(f._id.$in.map(String));
    rows = rows.filter((r) => !ids.has(String(r._id)));
    return {};
  }) as never);

  // requireActive and updateMe both read the user; the update returns the new state.
  vi.spyOn(User, "findById").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve({ role: "user", banned: false, ...current }) }),
  })) as never);
  vi.spyOn(User, "findByIdAndUpdate").mockImplementation(((
    _id: unknown,
    update: Record<string, unknown>,
  ) => ({
    lean: () => {
      current = { ...current!, ...update } as typeof current;
      return Promise.resolve({
        ...current,
        _id: new mongoose.Types.ObjectId(USER_ID),
        username: "sam",
        role: "user",
        createdAt: new Date(),
      });
    },
  })) as never);
});

const change = (avatarUrl: string | null) =>
  request(app).patch("/api/users/me").set(auth).send({ avatarUrl });

describe("profile photo limit", () => {
  it(`allows ${AVATAR_CHANGES_PER_DAY} changes in a day, then answers 429`, async () => {
    for (let i = 1; i <= AVATAR_CHANGES_PER_DAY; i++) {
      expect((await change(photo(i))).status).toBe(200);
    }
    const res = await change(photo(9));
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/3 times a day/);
    // The photo that was refused is not saved.
    expect(current!.avatarUrl).toBe(photo(AVATAR_CHANGES_PER_DAY));
  });

  it("removes the file that was uploaded for a refused change", async () => {
    for (let i = 1; i <= AVATAR_CHANGES_PER_DAY; i++) await change(photo(i));
    vi.mocked(deleteUploadIfUnused).mockClear();
    await change(photo(9));
    expect(deleteUploadIfUnused).toHaveBeenCalledWith(photo(9));
  });

  it("counts removing the photo as a change", async () => {
    await change(photo(1));
    await change(null);
    await change(photo(2));
    expect((await change(null)).status).toBe(429);
  });

  it("does not count a bio edit or saving the same photo again", async () => {
    current!.avatarUrl = photo(1);
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await request(app)
            .patch("/api/users/me")
            .set(auth)
            .send({ bio: `bio ${i}` })
        ).status,
      ).toBe(200);
      expect((await change(photo(1))).status).toBe(200);
    }
    expect(rows).toHaveLength(0);
  });

  it("reports what is left, and when the next change opens", async () => {
    let res = await request(app).get("/api/users/me/avatar-allowance").set(auth);
    expect(res.body).toMatchObject({ limit: 3, used: 0, remaining: 3, resetsAt: null });

    for (let i = 1; i <= 3; i++) await change(photo(i));
    res = await request(app).get("/api/users/me/avatar-allowance").set(auth);
    expect(res.body).toMatchObject({ used: 3, remaining: 0 });
    expect(new Date(res.body.resetsAt).getTime()).toBeGreaterThan(Date.now() + DAY - 60_000);
  });

  it("frees a change once the oldest one is more than a day old", async () => {
    for (let i = 1; i <= 3; i++) await change(photo(i));
    rows[0]!.createdAt = new Date(Date.now() - DAY - 1000);
    expect((await avatarAllowance(USER_ID)).remaining).toBe(1);
    expect((await change(photo(7))).status).toBe(200);
  });

  it("needs a login", async () => {
    expect((await request(app).get("/api/users/me/avatar-allowance")).status).toBe(401);
  });
});

describe("profile photo delivery", () => {
  it("serves a square face-centred crop at the allowed sizes only", () => {
    expect(imageTransform(128)).toBe("c_fill,g_face,w_128,h_128,f_auto,q_auto");
    expect(imageTransform(999)).toBe("f_auto,q_auto");
    expect(imageTransform(undefined)).toBe("f_auto,q_auto");
  });
});
