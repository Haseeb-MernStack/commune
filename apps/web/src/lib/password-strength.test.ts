import { describe, expect, it } from "vitest";

import { getPasswordStrength } from "./password-strength";

describe("getPasswordStrength", () => {
  it("rates a short password as Weak", () => {
    const result = getPasswordStrength("short");
    expect(result.label).toBe("Weak");
    expect(result.tips).toContain("Use at least 8 characters.");
  });

  it("rates a common password as Weak even when it is long enough", () => {
    const result = getPasswordStrength("password123");
    expect(result.label).toBe("Weak");
    expect(result.tips).toContain("Avoid common passwords.");
  });

  it("rates a mixed password as OK", () => {
    const result = getPasswordStrength("correct-horse");
    expect(result.label).toBe("OK");
  });

  it("rates a long mixed password with a digit and a symbol as Strong", () => {
    const result = getPasswordStrength("Correct-Horse9!");
    expect(result.label).toBe("Strong");
    expect(result.score).toBe(5);
  });
});
