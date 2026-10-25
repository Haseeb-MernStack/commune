/*
 * Commune service worker. Plain JavaScript on purpose: it is served as-is from /sw.js.
 *
 * What it does:
 *  - Makes the app installable and gives it a branded offline page.
 *  - Caches the app's own static files so repeat visits and slow networks are fast.
 *
 * What it deliberately does NOT do:
 *  - It never touches /api/* or /uploads/*, or any non-GET or cross-origin request. Account
 *    data, tokens and paid content are never stored in a cache.
 *
 * Bump VERSION to force every client to drop its old caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `commune-static-${VERSION}`;
const SHELL_CACHE = `commune-shell-${VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, SHELL_CACHE];

const OFFLINE_URL = "/offline.html";
const SHELL_KEY = "/__shell";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  // No skipWaiting here: a new version waits until the user taps "Reload" in the app, so a
  // page is never swapped to new code underneath someone who is typing.
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KNOWN_CACHES.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  // Vite fingerprints everything in /assets, so a given URL never changes: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

/** Network first (always the freshest app), with the cached shell or offline page as fallback. */
async function handleNavigation(request) {
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.ok && (response.headers.get("content-type") || "").includes("text/html")) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_KEY, response.clone());
    }
    return response;
  } catch {
    const shell = await (await caches.open(SHELL_CACHE)).match(SHELL_KEY);
    return shell || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}
