export type StrengthLevel = "weak" | "ok" | "strong";

export interface PasswordStrength {
  level: StrengthLevel;
  label: "Weak" | "OK" | "Strong";
  score: 1 | 2 | 3;
  tip: string | null;
}

const COMMON_PATTERNS = [
  "password",
  "123456",
  "12345678",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "commune",
];

function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

function hasSequentialRun(password: string): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    const d = lower.charCodeAt(i + 3);
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;
  }
  return false;
}

/**
 * Computes a local-only strength rating for the sign-up password hint.
 * Purely advisory — server validation (`registerSchema`) stays authoritative.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) {
    return {
      level: "weak",
      label: "Weak",
      score: 1,
      tip: "Use at least 8 characters.",
    };
  }

  const lower = password.toLowerCase();
  if (
    COMMON_PATTERNS.some((p) => lower.includes(p)) ||
    hasRepeatedChars(password) ||
    hasSequentialRun(password)
  ) {
    return {
      level: "weak",
      label: "Weak",
      score: 1,
      tip: "Avoid common words or predictable patterns.",
    };
  }

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (password.length >= 12 && classes >= 3) {
    return { level: "strong", label: "Strong", score: 3, tip: null };
  }

  if (password.length >= 10 && classes >= 2) {
    return {
      level: "ok",
      label: "OK",
      score: 2,
      tip: "Add more character variety or length for a stronger password.",
    };
  }

  if (classes >= 3) {
    return {
      level: "ok",
      label: "OK",
      score: 2,
      tip: "Longer passwords (12+ characters) are stronger.",
    };
  }

  return {
    level: "weak",
    label: "Weak",
    score: 1,
    tip: "Mix uppercase, lowercase, numbers, or symbols.",
  };
}
