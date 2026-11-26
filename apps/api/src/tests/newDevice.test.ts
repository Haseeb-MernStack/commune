import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Nothing is really sent: the mail service is replaced and every database call is stubbed.
vi.mock("../services/mailService.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { createApp } from "../app.js";
import { AuthToken } from "../models/AuthToken.js";
import { QuotaLog } from "../models/QuotaLog.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { deviceHash, notifyNewDeviceIfNeeded, parseDevice } from "../services/deviceService.js";
import { sendMail } from "../services/mailService.js";

const app = createApp();
const PASSWORD = "correct-horse-battery";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const USER_ID = new mongoose.Types.ObjectId();

// Short user agents: only the parts parseDevice reads.
const CHROME_WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
const SAFARI_IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/604.1";
const CHROME_WINDOWS_HASH = deviceHash(CHROME_WINDOWS_UA);

const sendMailMock = vi.mocked(sendMail);

function fakeUser(overrides: { knownDeviceHashes?: string[] } = {}) {
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
    knownDeviceHashes: [] as string[],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** login: User.findOne(...).select(...) */
const loginLookup = (value: unknown) =>
  vi.spyOn(User, "findOne").mockReturnValue({ select: () => Promise.resolve(value) } as never);

beforeEach(() => {
  vi.spyOn(RefreshToken, "create").mockResolvedValue({} as never);
  vi.spyOn(AuthToken, "deleteMany").mockResolvedValue({ deletedCount: 0 } as never);
  vi.spyOn(AuthToken, "create").mockResolvedValue({} as never);
  sendMailMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDevice", () => {
  it("identifies Chrome on Windows", () => {
    expect(parseDevice(CHROME_WINDOWS_UA)).toEqual({ family: "Chrome", os: "Windows" });
  });

  it("identifies Safari on iOS", () => {
    expect(parseDevice(SAFARI_IOS_UA)).toEqual({ family: "Safari", os: "iOS" });
  });

  it("falls back to unknown for a missing user agent", () => {
    expect(parseDevice(undefined)).toEqual({ family: "Unknown browser", os: "Unknown OS" });
  });
});

describe("notifyNewDeviceIfNeeded", () => {
  it("sends the notice the first time a device signs in", async () => {
    const updateOne = vi.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    const user = fakeUser();
    const sent = await notifyNewDeviceIfNeeded(user, CHROME_WINDOWS_UA);
    expect(sent).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: USER_ID, knownDeviceHashes: { $ne: CHROME_WINDOWS_HASH } },
      { $addToSet: { knownDeviceHashes: CHROME_WINDOWS_HASH } },
    );
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sam@example.com",
        subject: "New sign-in to your Commune account",
        text: expect.stringContaining("Chrome on Windows"),
        html: expect.stringContaining("Chrome on Windows"),
      }),
    );
    expect(sendMailMock.mock.calls[0]?.[0].text).toContain("/forgot-password");
  });

  it("does not send again for a device it already knows", async () => {
    const updateOne = vi.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    const user = fakeUser({ knownDeviceHashes: [CHROME_WINDOWS_HASH] });

    const sent = await notifyNewDeviceIfNeeded(user, CHROME_WINDOWS_UA);

    expect(sent).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("does not send when the mail quota is full", async () => {
    vi.mocked(QuotaLog.countDocuments).mockResolvedValue(6 as never);
    const updateOne = vi.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    const user = fakeUser();

    const sent = await notifyNewDeviceIfNeeded(user, CHROME_WINDOWS_UA);

    expect(sent).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("emails a notice when the device is new", async () => {
    vi.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    loginLookup(fakeUser());

    const res = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", CHROME_WINDOWS_UA)
      .send({ email: "sam@example.com", password: PASSWORD });

    expect(res.status).toBe(200);
    // The notice is sent in the background, after the response.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("does not email again for the same device", async () => {
    const updateOne = vi.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    loginLookup(fakeUser({ knownDeviceHashes: [CHROME_WINDOWS_HASH] }));

    const res = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", CHROME_WINDOWS_UA)
      .send({ email: "sam@example.com", password: PASSWORD });

    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });
});
