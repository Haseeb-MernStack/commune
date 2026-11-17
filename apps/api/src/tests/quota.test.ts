import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/mailService.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { createApp } from "../app.js";
import { AuthToken } from "../models/AuthToken.js";
import { QuotaLog } from "../models/QuotaLog.js";
import { User } from "../models/User.js";
import { reserveMail } from "../services/mailQuota.js";
import { DAY, HOUR, QuotaError, consumeQuota } from "../services/quota.js";
import { sendMail } from "../services/mailService.js";
import { signAccessToken } from "../utils/tokens.js";

interface Row {
  _id: mongoose.Types.ObjectId;
  bucket: string;
  subject: string;
  createdAt: Date;
}
let rows: Row[] = [];

/** A small in-memory stand-in for the QuotaLog collection. */
beforeEach(() => {
  rows = [];
  vi.mocked(sendMail).mockReset().mockResolvedValue(undefined);
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
    (async (f: { bucket: string; subject: string; createdAt: { $gte: Date } }) =>
      rows.filter(
        (r) => r.bucket === f.bucket && r.subject === f.subject && r.createdAt >= f.createdAt.$gte,
      ).length) as never,
  );
  vi.spyOn(QuotaLog, "deleteMany").mockImplementation((async (f: { _id: { $in: unknown[] } }) => {
    const ids = new Set(f._id.$in.map(String));
    rows = rows.filter((r) => !ids.has(String(r._id)));
    return {};
  }) as never);
});

const rule = (subject: string, limit = 3, windowMs = HOUR) => ({
  bucket: "test",
  subject,
  windows: [{ limit, windowMs }],
});

describe("consumeQuota", () => {
  it("allows up to the limit and then refuses with 429", async () => {
    for (let i = 0; i < 3; i++) await consumeQuota([rule("a")]);
    await expect(consumeQuota([rule("a")])).rejects.toBeInstanceOf(QuotaError);
    await expect(consumeQuota([rule("a")])).rejects.toMatchObject({ status: 429 });
  });

  it("does not count refused attempts, so the limit frees up on schedule", async () => {
    for (let i = 0; i < 3; i++) await consumeQuota([rule("a")]);
    for (let i = 0; i < 5; i++) await consumeQuota([rule("a")]).catch(() => undefined);
    expect(rows).toHaveLength(3);
  });

  it("counts each subject separately", async () => {
    for (let i = 0; i < 3; i++) await consumeQuota([rule("a")]);
    await expect(consumeQuota([rule("b")])).resolves.toBeUndefined();
  });

  it("ignores uses that are older than the window", async () => {
    for (let i = 0; i < 3; i++) await consumeQuota([rule("a")]);
    for (const r of rows) r.createdAt = new Date(Date.now() - 2 * HOUR);
    await expect(consumeQuota([rule("a")])).resolves.toBeUndefined();
  });

  it("enforces the daily window even when the hourly one has room", async () => {
    const daily = { bucket: "test", subject: "a", windows: [{ limit: 1, windowMs: DAY }] };
    await consumeQuota([daily]);
    for (const r of rows) r.createdAt = new Date(Date.now() - 2 * HOUR);
    await expect(consumeQuota([daily])).rejects.toBeInstanceOf(QuotaError);
  });
});

describe("reserveMail", () => {
  it("allows 3 emails an hour to one address", async () => {
    for (let i = 0; i < 3; i++)
      await reserveMail({ kind: "verify_email", to: "a@x.com", ip: `1.1.1.${i}` });
    await expect(
      reserveMail({ kind: "verify_email", to: "A@X.com", ip: "1.1.1.9" }),
    ).rejects.toBeInstanceOf(QuotaError);
    await expect(
      reserveMail({ kind: "verify_email", to: "other@x.com", ip: "1.1.1.9" }),
    ).resolves.toBeUndefined();
  });

  it("limits one visitor across many addresses", async () => {
    for (let i = 0; i < 10; i++)
      await reserveMail({ kind: "reset_password", to: `u${i}@x.com`, ip: "2.2.2.2" });
    await expect(
      reserveMail({ kind: "reset_password", to: "u99@x.com", ip: "2.2.2.2" }),
    ).rejects.toBeInstanceOf(QuotaError);
  });

  it("stops the whole site at the daily cap", async () => {
    for (let i = 0; i < 100; i++) {
      await reserveMail({
        kind: "verify_email",
        to: `u${i}@x.com`,
        ip: `3.3.${Math.floor(i / 5)}.${i % 5}`,
      });
    }
    await expect(
      reserveMail({ kind: "verify_email", to: "late@x.com", ip: "9.9.9.9" }),
    ).rejects.toBeInstanceOf(QuotaError);
  });

  it("limits contact messages per visitor per day", async () => {
    for (let i = 0; i < 5; i++) await reserveMail({ kind: "contact", ip: "4.4.4.4" });
    await expect(reserveMail({ kind: "contact", ip: "4.4.4.4" })).rejects.toThrow(/tomorrow/);
  });
});

describe("email routes", () => {
  const app = createApp();
  const USER_ID = "507f1f77bcf86cd799439011";
  const auth = { Authorization: `Bearer ${signAccessToken(USER_ID)}` };

  it("answers a password reset the same way when the limit is reached, and sends nothing", async () => {
    vi.spyOn(User, "findOne").mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            _id: USER_ID,
            email: "sam@example.com",
            username: "sam",
            banned: false,
          }),
      }),
    } as never);
    const create = vi.spyOn(AuthToken, "create").mockResolvedValue({} as never);
    vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({} as never);
    for (let i = 0; i < 3; i++)
      await reserveMail({ kind: "reset_password", to: "sam@example.com" });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "sam@example.com" });
    expect(res.status).toBe(202);
    expect(sendMail).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tells a signed-in person when they asked for too many confirmation emails", async () => {
    vi.spyOn(User, "findById").mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            email: "sam@example.com",
            username: "sam",
            emailVerified: false,
            banned: false,
          }),
      }),
    } as never);
    const create = vi.spyOn(AuthToken, "create").mockResolvedValue({} as never);
    const del = vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({} as never);
    for (let i = 0; i < 3; i++) await reserveMail({ kind: "verify_email", to: "sam@example.com" });

    const res = await request(app).post("/api/auth/resend-verification").set(auth);
    expect(res.status).toBe(429);
    expect(sendMail).not.toHaveBeenCalled();
    // The link the person already has must keep working.
    expect(create).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
