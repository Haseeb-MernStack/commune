import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength } from "./passwordStrength";

describe("evaluatePasswordStrength", () => {
  it("rates passwords shorter than 8 characters as Weak", () => {
    const result = evaluatePasswordStrength("abc12");
    expect(result.level).toBe("weak");
    expect(result.label).toBe("Weak");
    expect(result.score).toBe(1);
    expect(result.tip).toMatch(/8 characters/);
  });

  it("downgrades common or predictable patterns even when 8+ characters", () => {
    expect(evaluatePasswordStrength("Password123!").level).toBe("weak");
    expect(evaluatePasswordStrength("qwerty1234!").level).toBe("weak");
    expect(evaluatePasswordStrength("aaaabbbbcccc").level).toBe("weak");
    expect(evaluatePasswordStrength("abcd9876!").level).toBe("weak");
  });

  it("rates 8+ single-class passwords as Weak with variety tip", () => {
    const result = evaluatePasswordStrength("plainwords");
    expect(result.level).toBe("weak");
    expect(result.tip).toMatch(/Mix uppercase/i);
  });

  it("rates medium length mixed-character passwords as OK", () => {
    const result = evaluatePasswordStrength("Correct99");
    expect(result.level).toBe("ok");
    expect(result.label).toBe("OK");
    expect(result.score).toBe(2);
    expect(result.tip).toBeTruthy();
  });

  it("rates 12+ character mixed-class passwords as Strong with no extra tip", () => {
    const result = evaluatePasswordStrength("correct-horse9!");
    expect(result.level).toBe("strong");
    expect(result.label).toBe("Strong");
    expect(result.score).toBe(3);
    expect(result.tip).toBeNull();
  });
});
