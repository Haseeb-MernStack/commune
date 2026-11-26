import { describe, expect, it } from "vitest";
import { resolveReportSchema } from "@commune/shared";

describe("resolveReportSchema", () => {
  it("accepts a reason and a 7-day duration", () => {
    const result = resolveReportSchema.safeParse({
      action: "remove_post_and_ban",
      reason: "Spam",
      durationDays: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null duration (permanent)", () => {
    const result = resolveReportSchema.safeParse({
      action: "remove_post_and_ban",
      durationDays: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a duration of 0", () => {
    const result = resolveReportSchema.safeParse({
      action: "remove_post_and_ban",
      durationDays: 0,
    });
    expect(result.success).toBe(false);
  });
});
