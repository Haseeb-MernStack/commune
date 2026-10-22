import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Nothing is really sent: the mail service is replaced and every database call is stubbed.
vi.mock("../services/mailService.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { createApp } from "../app.js";
import { AuthToken } from "../models/AuthToken.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { sendMail } from "../services/mailService.js";
import { hashToken, signAccessToken } from "../utils/tokens.js";

const app = createApp();
const TOKEN = "a".repeat(96);
const USER_ID = "507f1f77bcf86cd799439011";
const auth = { Authorization: `Bearer ${signAccessToken(USER_ID)}` };

const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

beforeEach(() => {
  vi.mocked(sendMail).mockReset().mockResolvedValue(undefined);
  vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({ deletedCount: 0 } as never);
  vi.spyOn(AuthToken, "create").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/forgot-password", () => {
  it("rejects a malformed email", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "nope" });
    expect(res.status).toBe(400);
  });

  it("answers 202 and sends nothing for an unknown email", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(chain(null) as never);
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });
    expect(res.status).toBe(202);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("answers 202 and emails a hashed-at-rest reset link for a known email", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(
      chain({ _id: USER_ID, email: "sam@example.com", username: "sam", banned: false }) as never,
    );
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "Sam@Example.com" });
    expect(res.status).toBe(202);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = vi.mocked(sendMail).mock.calls[0]![0];
    expect(mail.to).toBe("sam@example.com");
    const raw = /reset-password\?token=([a-f0-9]{96})/.exec(mail.text)?.[1];
    expect(raw).toBeDefined();
    // The database gets the hash, never the raw token from the email.
    const stored = vi.mocked(AuthToken.create).mock.calls[0]![0] as unknown as {
      tokenHash: string;
      purpose: string;
    };
    expect(stored.purpose).toBe("reset_password");
    expect(stored.tokenHash).toBe(hashToken(raw!));
    expect(stored.tokenHash).not.toBe(raw);
  });

  it("does not email suspended accounts", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(
      chain({ _id: USER_ID, email: "a@b.co", username: "x", banned: true }) as never,
    );
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "a@b.co" });
    expect(res.status).toBe(202);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rejects a short password and a bad token shape", async () => {
    const short = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: TOKEN, password: "short" });
    expect(short.status).toBe(400);
    const badToken = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "xyz", password: "longenough1" });
    expect(badToken.status).toBe(400);
  });

  it("rejects an unknown, used or expired token", async () => {
    vi.spyOn(AuthToken, "findOneAndDelete").mockResolvedValue(null as never);
    const unknown = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: TOKEN, password: "longenough1" });
    expect(unknown.status).toBe(400);

    vi.spyOn(AuthToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    const expired = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: TOKEN, password: "longenough1" });
    expect(expired.status).toBe(400);
  });

  it("sets the new password, verifies the email and signs out every session", async () => {
    const find = vi.spyOn(AuthToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    const sessions = vi.spyOn(RefreshToken, "deleteMany").mockResolvedValue({} as never);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: TOKEN, password: "brand-new-pass" });
    expect(res.status).toBe(204);

    expect(find).toHaveBeenCalledWith({ tokenHash: hashToken(TOKEN), purpose: "reset_password" });
    // Mongoose's overloads make the mock's argument tuple too narrow, so read it as unknown[].
    const args = update.mock.calls[0] as unknown as [
      unknown,
      { $set: { passwordHash: string; emailVerified: boolean } },
    ];
    const set = args[1].$set;
    expect(set.emailVerified).toBe(true);
    expect(await bcrypt.compare("brand-new-pass", set.passwordHash)).toBe(true);
    expect(sessions).toHaveBeenCalledWith({ user: USER_ID });
  });
});

describe("POST /api/auth/verify-email", () => {
  it("rejects an invalid token", async () => {
    vi.spyOn(AuthToken, "findOneAndDelete").mockResolvedValue(null as never);
    const res = await request(app).post("/api/auth/verify-email").send({ token: TOKEN });
    expect(res.status).toBe(400);
  });

  it("marks the email verified", async () => {
    vi.spyOn(AuthToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/auth/verify-email").send({ token: TOKEN });
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ _id: USER_ID }, { $set: { emailVerified: true } });
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("requires a login", async () => {
    const res = await request(app).post("/api/auth/resend-verification");
    expect(res.status).toBe(401);
  });

  it("sends a new link to an unverified user", async () => {
    vi.spyOn(User, "findById").mockReturnValue(
      chain({ _id: USER_ID, email: "sam@example.com", username: "sam", emailVerified: false }) as never,
    );
    const res = await request(app).post("/api/auth/resend-verification").set(auth);
    expect(res.status).toBe(204);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMail).mock.calls[0]![0].text).toContain("/verify-email?token=");
  });

  it("does nothing for an already verified user", async () => {
    vi.spyOn(User, "findById").mockReturnValue(
      chain({ _id: USER_ID, email: "sam@example.com", username: "sam", emailVerified: true }) as never,
    );
    const res = await request(app).post("/api/auth/resend-verification").set(auth);
    expect(res.status).toBe(204);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("refuses suspended accounts", async () => {
    vi.spyOn(User, "findById").mockReturnValue(
      chain({ _id: USER_ID, email: "a@b.co", username: "x", emailVerified: false, banned: true }) as never,
    );
    const res = await request(app).post("/api/auth/resend-verification").set(auth);
    expect(res.status).toBe(403);
  });
});