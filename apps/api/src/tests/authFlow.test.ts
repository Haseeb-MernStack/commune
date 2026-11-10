import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Nothing is really sent: the mail service is replaced and every database call is stubbed.
vi.mock("../services/mailService.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { createApp } from "../app.js";
import { AuthToken } from "../models/AuthToken.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { hashToken, verifyAccessToken } from "../utils/tokens.js";

/**
 * The sign-in flows that every other feature depends on: register, login, refresh-token
 * rotation and logout. A regression here locks everyone out, or lets the wrong person in.
 */

const app = createApp();
const PASSWORD = "correct-horse-battery";
// A cheap hash keeps the tests fast; the app itself uses a stronger cost.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const USER_ID = new mongoose.Types.ObjectId();

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: USER_ID,
    username: "sam",
    email: "sam@example.com",
    bio: "",
    avatarUrl: null,
    role: "user",
    plusUntil: null,
    emailVerified: true,
    banned: false,
    failedLogins: 0,
    lockUntil: null,
    passwordHash: PASSWORD_HASH,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** register: User.findOne(...).or(...).collation(...).lean() */
const registerLookup = (value: unknown) =>
  vi.spyOn(User, "findOne").mockReturnValue({
    or: () => ({ collation: () => ({ lean: () => Promise.resolve(value) }) }),
  } as never);

/** login: User.findOne(...).select(...) */
const loginLookup = (value: unknown) =>
  vi.spyOn(User, "findOne").mockReturnValue({ select: () => Promise.resolve(value) } as never);

const cookieOf = (res: request.Response): string => {
  const raw = res.headers["set-cookie"] as unknown as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith("commune_rt=")) ?? "";
};
const cookieValue = (cookie: string) => cookie.split(";")[0]!.split("=")[1] ?? "";

beforeEach(() => {
  vi.spyOn(RefreshToken, "create").mockResolvedValue({} as never);
  vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({ deletedCount: 0 } as never);
  vi.spyOn(AuthToken, "create").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates the account, hashes the password and starts a session", async () => {
    registerLookup(null);
    const create = vi
      .spyOn(User, "create")
      .mockImplementation((async (doc: object) =>
        fakeUser(doc as Record<string, unknown>)) as never);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "sam", email: "Sam@Example.com", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("sam");
    expect(typeof res.body.accessToken).toBe("string");
    expect(verifyAccessToken(res.body.accessToken)).toBe(USER_ID.toString());
    // Never returned, and never stored as plain text.
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const stored = create.mock.calls[0]![0] as unknown as { passwordHash: string; email: string };
    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, stored.passwordHash)).toBe(true);
    expect(stored.email).toBe("sam@example.com");
  });

  it("sets the refresh token as an httpOnly cookie limited to the auth routes", async () => {
    registerLookup(null);
    vi.spyOn(User, "create").mockResolvedValue(fakeUser() as never);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "sam", email: "sam@example.com", password: PASSWORD });
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
  });

  it("answers 409 when the email or username is taken", async () => {
    registerLookup(fakeUser());
    const create = vi.spyOn(User, "create");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "sam", email: "sam@example.com", password: PASSWORD });
    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a bad email, a short password and an invalid username", async () => {
    const create = vi.spyOn(User, "create");
    const send = (body: object) => request(app).post("/api/auth/register").send(body);
    expect((await send({ username: "sam", email: "nope", password: PASSWORD })).status).toBe(400);
    expect((await send({ username: "sam", email: "a@b.co", password: "short" })).status).toBe(400);
    expect(
      (await send({ username: "no spaces!", email: "a@b.co", password: PASSWORD })).status,
    ).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  const login = (password = PASSWORD) =>
    request(app).post("/api/auth/login").send({ email: "sam@example.com", password });

  it("signs in with the right password", async () => {
    loginLookup(fakeUser());
    const res = await login();
    expect(res.status).toBe(200);
    expect(verifyAccessToken(res.body.accessToken)).toBe(USER_ID.toString());
    expect(cookieOf(res)).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    vi.spyOn(User, "findOneAndUpdate").mockReturnValue({
      select: () => Promise.resolve({ failedLogins: 1 }),
    } as never);

    loginLookup(fakeUser());
    const wrongPassword = await login("not-the-password");
    loginLookup(null);
    const unknownEmail = await login();

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(cookieOf(wrongPassword)).toBe("");
  });

  it("counts a wrong password, and only for accounts that exist", async () => {
    const count = vi.spyOn(User, "findOneAndUpdate").mockReturnValue({
      select: () => Promise.resolve({ failedLogins: 1 }),
    } as never);
    loginLookup(fakeUser());
    await login("not-the-password");
    expect(count).toHaveBeenCalledTimes(1);

    count.mockClear();
    loginLookup(null);
    await login("not-the-password");
    expect(count).not.toHaveBeenCalled();
  });

  it("locks the account after too many wrong passwords", async () => {
    vi.spyOn(User, "findOneAndUpdate").mockReturnValue({
      select: () => Promise.resolve({ failedLogins: 8 }),
    } as never);
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    loginLookup(fakeUser());
    await login("not-the-password");
    const [, change] = update.mock.calls[0] as unknown as [unknown, { $set: { lockUntil: Date } }];
    expect(change.$set.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses a locked account even with the right password, without saying why", async () => {
    loginLookup(fakeUser({ lockUntil: new Date(Date.now() + 60_000) }));
    const res = await login();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("refuses a suspended account", async () => {
    loginLookup(fakeUser({ banned: true }));
    const res = await login();
    expect(res.status).toBe(403);
    expect(cookieOf(res)).toBe("");
  });

  it("clears the failure counter after a good login", async () => {
    const update = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
    loginLookup(fakeUser({ failedLogins: 3 }));
    const res = await login();
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { failedLogins: 0, lockUntil: null } },
    );
  });
});

describe("POST /api/auth/refresh", () => {
  const TOKEN = "t".repeat(64);
  const refresh = (token?: string) => {
    const req = request(app).post("/api/auth/refresh");
    return token ? req.set("Cookie", `commune_rt=${token}`) : req;
  };

  it("swaps the old token for a new one and returns a new access token", async () => {
    const consume = vi.spyOn(RefreshToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.spyOn(User, "findById").mockResolvedValue(fakeUser() as never);

    const res = await refresh(TOKEN);

    expect(res.status).toBe(200);
    expect(verifyAccessToken(res.body.accessToken)).toBe(USER_ID.toString());
    // The presented token is looked up by its hash and consumed...
    expect(consume).toHaveBeenCalledWith({ tokenHash: hashToken(TOKEN) });
    // ...and a different one is issued in its place.
    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(cookieValue(cookieOf(res))).not.toBe(TOKEN);
    expect(cookieValue(cookieOf(res))).not.toBe("");
  });

  it("answers 401 without a cookie", async () => {
    const consume = vi.spyOn(RefreshToken, "findOneAndDelete");
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(consume).not.toHaveBeenCalled();
  });

  it("rejects a token that was already used or never existed, and clears the cookie", async () => {
    vi.spyOn(RefreshToken, "findOneAndDelete").mockResolvedValue(null as never);
    const res = await refresh(TOKEN);
    expect(res.status).toBe(401);
    expect(cookieOf(res)).toMatch(/commune_rt=;/);
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    vi.spyOn(RefreshToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    const res = await refresh(TOKEN);
    expect(res.status).toBe(401);
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });

  it("ends the session of a suspended or deleted account", async () => {
    vi.spyOn(RefreshToken, "findOneAndDelete").mockResolvedValue({
      user: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    const findUser = vi.spyOn(User, "findById");

    findUser.mockResolvedValue(fakeUser({ banned: true }) as never);
    expect((await refresh(TOKEN)).status).toBe(401);

    findUser.mockResolvedValue(null as never);
    expect((await refresh(TOKEN)).status).toBe(401);
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    const remove = vi.spyOn(RefreshToken, "deleteOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/auth/logout").set("Cookie", "commune_rt=abc123");
    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith({ tokenHash: hashToken("abc123") });
    expect(cookieOf(res)).toMatch(/commune_rt=;/);
  });

  it("still succeeds when there is no session", async () => {
    const remove = vi.spyOn(RefreshToken, "deleteOne");
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("access tokens", () => {
  it("are refused on protected routes when missing or not valid", async () => {
    expect((await request(app).post("/api/posts").send({ content: "hi" })).status).toBe(401);
    const bad = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ content: "hi" });
    expect(bad.status).toBe(401);
  });
});
