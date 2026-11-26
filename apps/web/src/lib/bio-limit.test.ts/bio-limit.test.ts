import { describe, expect, it } from "vitest";
import { BIO_MAX_LENGTH, updateProfileSchema } from "@commune/shared";

describe("BIO_MAX_LENGTH", () => {
  it("is the single limit the bio editor and the API share", () => {
    expect(BIO_MAX_LENGTH).toBe(160);
  });

  it("lets a bio of exactly the limit through and rejects a longer one", () => {
    expect(
      updateProfileSchema.safeParse({ bio: "x".repeat(BIO_MAX_LENGTH) }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({ bio: "x".repeat(BIO_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });
});
