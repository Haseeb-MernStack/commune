import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeAgo } from "./time";

const NOW = new Date("2026-11-25T12:00:00.000Z");

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds for a post from just now", () => {
    expect(timeAgo(isoSecondsAgo(0))).toBe("1s");
    expect(timeAgo(isoSecondsAgo(5))).toBe("5s");
    expect(timeAgo(isoSecondsAgo(59))).toBe("59s");
  });

  it("returns minutes from 60 seconds", () => {
    expect(timeAgo(isoSecondsAgo(60))).toBe("1m");
    expect(timeAgo(isoSecondsAgo(90))).toBe("1m");
    expect(timeAgo(isoSecondsAgo(59 * 60))).toBe("59m");
  });

  it("returns hours from 60 minutes", () => {
    expect(timeAgo(isoSecondsAgo(60 * 60))).toBe("1h");
    expect(timeAgo(isoSecondsAgo(23 * 3600))).toBe("23h");
  });

  it("returns days from 24 hours", () => {
    expect(timeAgo(isoSecondsAgo(24 * 3600))).toBe("1d");
    expect(timeAgo(isoSecondsAgo(6 * 86400))).toBe("6d");
  });

  it("returns days for a date older than a week", () => {
    expect(timeAgo(isoSecondsAgo(10 * 86400))).toBe("10d");
  });

  it("clamps a future time to one second", () => {
    const future = new Date(NOW.getTime() + 60 * 1000).toISOString();
    expect(timeAgo(future)).toBe("1s");
  });
});
