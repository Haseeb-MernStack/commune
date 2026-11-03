import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export interface Principal {
  userId: string;
  /** When the access token stops being valid, in milliseconds since the epoch. */
  expiresAt: number;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Verifies an API access token. Returns null for anything that is not a valid, unexpired one. */
export function verifyToken(token: unknown, secret: string): Principal | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 2000) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string") return null;
    if (typeof payload.sub !== "string" || !OBJECT_ID.test(payload.sub)) return null;
    if (typeof payload.exp !== "number") return null;
    return { userId: payload.sub, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}

/** Constant-time comparison for secrets (hashing first makes the lengths equal). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function bearer(header: string | undefined): string {
  return header?.startsWith("Bearer ") ? header.slice(7) : "";
}
