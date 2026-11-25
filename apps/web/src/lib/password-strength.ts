export type PasswordStrengthLabel = "Weak" | "OK" | "Strong";

export interface PasswordStrengthResult {
  score: number;
  label: PasswordStrengthLabel;
  tips: string[];
}

const COMMON_PASSWORDS = [
  "password",
  "123456",
  "12345678",
  "qwerty",
  "letmein",
  "admin",
  "welcome",
  "abc123",
  "111111",
  "password1",
];

const COMMON_PATTERNS = ["password", "1234", "qwerty", "letmein", "admin"];

// Small, local-only helper for the sign-up meter. It never sends the
// password anywhere; the server's rules remain the final judge.
export function getPasswordStrength(password: string): PasswordStrengthResult {
  const tips: string[] = [];
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (hasLower && hasUpper) score += 1;
  if (hasDigit) score += 1;
  if (hasSymbol) score += 1;
  const lower = password.toLowerCase();
  const isCommon =
    COMMON_PASSWORDS.includes(lower) ||
    COMMON_PATTERNS.some((pattern) => lower.includes(pattern));
  if (isCommon) score = Math.min(score, 1);
  if (password.length < 8) tips.push("Use at least 8 characters.");
  if (!(hasLower && hasUpper)) tips.push("Add upper and lower case letters.");
  if (!hasDigit) tips.push("Add a number.");
  if (!hasSymbol) tips.push("Add a symbol such as ! or -.");
  if (isCommon) tips.push("Avoid common passwords.");
  const label: PasswordStrengthLabel =
    score <= 1 ? "Weak" : score <= 3 ? "OK" : "Strong";
  return { score, label, tips };
}
