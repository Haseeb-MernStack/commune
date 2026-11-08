import { describe, expect, it } from "vitest";
import { TokenBucket } from "../limits.js";

describe("TokenBucket", () => {
  it("allows a burst, then refuses", () => {
    const bucket = new TokenBucket(3, 0.001);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});
