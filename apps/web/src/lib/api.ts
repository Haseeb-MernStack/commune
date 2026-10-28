import type { AuthResponse } from "@commune/shared";

// Production builds always call the same origin ("/api"), which Vercel forwards to the API
// (see apps/web/vercel.json). That keeps the login cookie first-party. VITE_API_URL is only
// used in development, so a stray value in the hosting dashboard can't break a deployed site.
const BASE = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api");
// Uploaded files are served from the API origin, e.g. http://localhost:4000/uploads/abc.png.
// With a relative VITE_API_URL such as "/api" this is "", so "/uploads/..." stays relative.
const ORIGIN = BASE.replace(/\/api\/?$/, "");

let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// ---- Session hint: lets the app skip, or start earlier, the "am I logged in?" round trip ----
// "1" = this browser has a session, "0" = known guest, missing = unknown (ask the server once).
// The hint is never trusted for access; the server still checks every request.
const HINT_KEY = "commune_session";
export type SessionHint = "1" | "0" | null;

export function readSessionHint(): SessionHint {
  try {
    const v = localStorage.getItem(HINT_KEY);
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
}

export function writeSessionHint(hint: "1" | "0") {
  try {
    localStorage.setItem(HINT_KEY, hint);
  } catch {
    /* private mode or blocked storage: the app just works without the shortcut */
  }
}

// index.html starts a few requests before this script has even downloaded (news, public
// posts, session refresh). Take the response over once instead of asking the server again.
type EarlyMap = Record<string, Promise<Response> | undefined>;
function takeEarly(path: string): Promise<Response> | undefined {
  const map = (window as unknown as { __early?: EarlyMap }).__early;
  const hit = map?.[path];
  if (map) delete map[path];
  return hit;
}

async function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (takeEarly("/auth/refresh") ?? fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" }))
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function refresh(): Promise<boolean> {
  return (await refreshSession()) !== null;
}

// Starts at page load (not after React renders) unless this browser is a known guest.
let boot: Promise<AuthResponse | null> | null = readSessionHint() === "0" ? null : refreshSession();
void boot?.finally(() => {
  boot = null;
});
const bootPromise = boot;
/** Resolves with the restored session (or null). Used once by the AuthProvider. */
export const bootSession = (): Promise<AuthResponse | null> => bootPromise ?? Promise.resolve(null);

/** Turns a stored upload path like "/uploads/x.png" into a URL the browser can load. */
export function assetUrl(path: string | null | undefined): string | undefined {
  return path ? `${ORIGIN}${path}` : undefined;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const isForm = options.body instanceof FormData;
  // Requests that need a login wait for the session restore that is already in flight, instead
  // of going out without a token, failing with 401 and being repeated.
  if (boot && !accessToken && !path.startsWith("/auth/")) await boot;

  const send = () =>
    fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        // For FormData the browser sets the multipart Content-Type (with boundary) itself.
        ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body
        ? isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body)
        : undefined,
    });

  // A plain GET may already have been started by index.html; use that response if it worked.
  const early = !options.method && !options.body && retry ? takeEarly(path) : undefined;
  const earlyRes = early ? await early.catch(() => undefined) : undefined;
  const res = earlyRes?.ok ? earlyRes : await send();

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return api<T>(path, options, false);
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    // Hosting platforms answer some failures (too large, overloaded) with a plain page, not our JSON.
    const fallback =
      res.status === 413
        ? "That file is too large."
        : res.status === 429
          ? "Too many requests, wait a moment and try again."
          : res.status >= 500
            ? "The server had a problem. Try again in a moment."
            : "Something went wrong";
    throw new ApiError(res.status, data.error ?? fallback);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Builds "/path?a=1&b=2", skipping undefined or empty values. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

export { refresh as tryRefresh };
