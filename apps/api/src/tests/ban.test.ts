import { describe, expect, it } from "vitest";
import { banMessage, isBanned } from "../utils/ban.js";

const NOW = new Date("2026-11-26T12:00:00.000Z");
const TOMORROW = new Date("2026-11-27T12:00:00.000Z");
const YESTERDAY = new Date("2026-11-25T12:00:00.000Z");

describe("isBanned", () => {
  it("returns false for an account that was never banned", () => {
    expect(isBanned({ banned: false }, NOW)).toBe(false);
  });

  it("returns true for a permanent ban", () => {
    expect(isBanned({ banned: true }, NOW)).toBe(true);
    expect(isBanned({ banned: true, bannedUntil: null }, NOW)).toBe(true);
  });

  it("returns true while a temporary ban is still active", () => {
    expect(isBanned({ banned: true, bannedUntil: TOMORROW }, NOW)).toBe(true);
  });

  it("returns false once a temporary ban has expired", () => {
    expect(isBanned({ banned: true, bannedUntil: YESTERDAY }, NOW)).toBe(false);
  });
});

describe("banMessage", () => {
  it("returns the current message when there is no reason or end date", () => {
    expect(banMessage({ banned: true })).toBe("This account has been suspended");
  });

  it("includes the reason when one was recorded", () => {
    expect(banMessage({ banned: true, banReason: "Spam" })).toContain("Spam");
  });

  it("includes the end date when one was recorded", () => {
    expect(banMessage({ banned: true, bannedUntil: TOMORROW })).toContain("27 Nov 2026");
  });
});
