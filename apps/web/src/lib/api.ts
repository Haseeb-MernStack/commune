import type { AuthResponse } from "@commune/shared";

// Production builds call the same origin ("/api"), which Vercel forwards to the API (see
// apps/web/vercel.json). That keeps the login cookie first-party. Local dev talks to :4000.
const BASE =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");
// Uploaded files are served from the API origin, e.g. http://localhost:4000/uploads/abc.png.
// With a relative VITE_API_URL such as "/api" this is "", so "/uploads/..." stays relative.
const ORIGIN = BASE.replace(/\/api\/?$/, "");

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

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

async function refresh(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
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

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return api<T>(path, options, false);
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? "Something went wrong");
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
