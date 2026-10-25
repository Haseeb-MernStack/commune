import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError, unauthorized } from "../utils/errors.js";

/**
 * Verifies a Google ID token (the "credential" from Sign in with Google) without any extra
 * dependency: the RS256 signature is checked against Google's published public keys, then the
 * claims are checked. Nothing in the token is trusted before the signature is valid.
 */
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const CLOCK_SKEW_MS = 60_000;

interface KeyCache {
  keys: Map<string, crypto.KeyObject>;
  fetchedAt: number;
  expiresAt: number;
}
let cache: KeyCache | null = null;

async function loadKeys(): Promise<KeyCache> {
  let res: Response;
  try {
    res = await fetch(CERTS_URL);
  } catch {
    throw new AppError(502, "Google sign-in is unavailable right now");
  }
  if (!res.ok) throw new AppError(502, "Google sign-in is unavailable right now");

  const body = (await res.json()) as { keys?: (crypto.JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, crypto.KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kid && jwk.kty === "RSA") {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    }
  }
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1];
  const now = Date.now();
  cache = { keys, fetchedAt: now, expiresAt: now + (maxAge ? Number(maxAge) : 3600) * 1000 };
  return cache;
}

async function findKey(kid: string): Promise<crypto.KeyObject | undefined> {
  const now = Date.now();
  if (cache && now < cache.expiresAt && cache.keys.has(kid)) return cache.keys.get(kid);
  // Unknown key id: Google may have rotated keys. Refetch, but at most once a minute.
  if (!cache || now >= cache.expiresAt || now - cache.fetchedAt > 60_000) await loadKeys();
  return cache?.keys.get(kid);
}

const decode = (part: string) => Buffer.from(part, "base64url");

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
}

export async function verifyGoogleIdToken(token: string): Promise<GoogleProfile> {
  const fail = () => unauthorized("Google sign-in failed");
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "Google sign-in is not set up");

  const parts = token.split(".");
  if (parts.length !== 3) throw fail();
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let claims: {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  };
  try {
    header = JSON.parse(decode(headerPart).toString("utf8"));
    claims = JSON.parse(decode(payloadPart).toString("utf8"));
  } catch {
    throw fail();
  }

  if (header.alg !== "RS256" || !header.kid) throw fail();
  const key = await findKey(header.kid);
  if (!key) throw fail();
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    key,
    decode(signaturePart),
  );
  if (!valid) throw fail();

  if (!claims.iss || !ISSUERS.includes(claims.iss)) throw fail();
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw fail();
  if (typeof claims.exp !== "number" || claims.exp * 1000 + CLOCK_SKEW_MS < Date.now()) throw fail();
  if (!claims.sub || !claims.email) throw fail();
  // Only trust an email address Google itself has verified.
  if (claims.email_verified !== true && claims.email_verified !== "true") throw fail();

  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? null };
}
