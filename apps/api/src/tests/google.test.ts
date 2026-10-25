import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The client id must exist before the config module is first imported.
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
});

import { createApp } from "../app.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";

const app = createApp();
const CLIENT_ID = "test-client.apps.googleusercontent.com";

// A throwaway RSA key pair stands in for Google's signing keys.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key-1", alg: "RS256", use: "sig" };

const b64 = (value: object | Buffer) =>
  Buffer.from(value instanceof Buffer ? value : JSON.stringify(value)).toString("base64url");

function idToken(
  claims: Record<string, unknown> = {},
  opts: { kid?: string; key?: crypto.KeyObject; alg?: string } = {},
) {
  const header = b64({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "test-key-1", typ: "JWT" });
  const payload = b64({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "Sam@Example.com",
    email_verified: true,
    name: "Sam Rivers",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  });
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), opts.key ?? privateKey);
  return `${header}.${payload}.${b64(sig)}`;
}

const post = (credential: string) => request(app).post("/api/auth/google").send({ credential });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=3600" }),
      json: async () => ({ keys: [jwk] }),
    }),
  );
  vi.spyOn(RefreshToken, "create").mockResolvedValue({} as never);
  vi.spyOn(RefreshToken, "deleteMany").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const newUser = (overrides: Record<string, unknown> = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  username: "SamRivers",
  email: "sam@example.com",
  bio: "",
  avatarUrl: null,
  role: "user",
  banned: false,
  emailVerified: true,
  createdAt: new Date(),
  ...overrides,
});

describe("POST /api/auth/google: token checks", () => {
  it("rejects a malformed credential before doing anything", async () => {
    expect((await request(app).post("/api/auth/google").send({})).status).toBe(400);
    expect((await post("x".repeat(120))).status).toBe(401);
  });

  it("rejects a token signed with a different key", async () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const res = await post(idToken({}, { key: other.privateKey }));
    expect(res.status).toBe(401);
  });

  it("rejects a wrong audience, issuer, expired token and unverified email", async () => {
    for (const claims of [
      { aud: "someone-elses-app" },
      { iss: "https://evil.example" },
      { exp: Math.floor(Date.now() / 1000) - 3600 },
      { email_verified: false },
    ]) {
      expect((await post(idToken(claims))).status).toBe(401);
    }
  });

  it("rejects algorithm tricks and unknown key ids", async () => {
    expect((await post(idToken({}, { alg: "none" }))).status).toBe(401);
    expect((await post(idToken({}, { kid: "unknown" }))).status).toBe(401);
  });
});

describe("POST /api/auth/google: accounts", () => {
  it("signs in a returning Google user", async () => {
    vi.spyOn(User, "findOne").mockResolvedValue(newUser() as never);
    const create = vi.spyOn(User, "create");
    const res = await post(idToken());
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.user.username).toBe("SamRivers");
    expect(create).not.toHaveBeenCalled();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/commune_rt=/);
  });

  it("creates a verified account with a safe unique username for a new user", async () => {
    vi.spyOn(User, "findOne").mockResolvedValue(null as never);
    vi.spyOn(User, "exists").mockReturnValue({ collation: () => Promise.resolve(null) } as never);
    let doc: Record<string, unknown> = {};
    vi.spyOn(User, "create").mockImplementation((async (input: Record<string, unknown>) => {
      doc = input;
      return newUser(input);
    }) as never);

    const res = await post(idToken({ name: "Sam Rivers!" }));
    expect(res.status).toBe(200);
    expect(doc.username).toBe("SamRivers");
    expect(doc.email).toBe("sam@example.com");
    expect(doc.googleId).toBe("google-sub-1");
    expect(doc.emailVerified).toBe(true);
    // A random, unknown password: not the email, not the Google id.
    expect(String(doc.passwordHash)).toMatch(/^\$2[aby]\$/);
  });

  it("links an existing password account and cancels a password set before verification", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const existing = newUser({ emailVerified: false, passwordHash: "old-hash", googleId: undefined, save });
    vi.spyOn(User, "findOne").mockImplementation(((filter: Record<string, unknown>) =>
      Promise.resolve("googleId" in filter ? null : existing)) as never);

    const res = await post(idToken());
    expect(res.status).toBe(200);
    expect(existing.googleId).toBe("google-sub-1");
    expect(existing.emailVerified).toBe(true);
    expect(existing.passwordHash).not.toBe("old-hash");
    expect(save).toHaveBeenCalled();
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ user: existing._id });
  });

  it("refuses suspended accounts", async () => {
    vi.spyOn(User, "findOne").mockResolvedValue(newUser({ banned: true }) as never);
    const res = await post(idToken());
    expect(res.status).toBe(403);
  });
});
