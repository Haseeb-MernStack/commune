/**
 * Downloads the code for pages BEFORE the person opens them, so a tap feels instant.
 * The import paths match the lazy() imports in App.tsx, so the bundler uses the same file.
 */
const loaders: Array<[prefix: string, load: () => Promise<unknown>]> = [
  ["/messages", () => import("../pages/MessagesPage")],
  ["/notifications", () => import("../pages/NotificationsPage")],
  ["/u/", () => import("../pages/ProfilePage")],
  ["/posts/", () => import("../pages/PostPage")],
  ["/news", () => import("../pages/NewsPage")],
  ["/communities", () => import("../pages/CommunitiesPage")],
  ["/c/", () => import("../pages/CommunityPage")],
  ["/search", () => import("../pages/SearchPage")],
];

const started = new Set<string>();

/** Safe to call many times (on hover, focus or touch): each page is fetched once. */
export function prefetchRoute(path: string) {
  const hit = loaders.find(([prefix]) => path.startsWith(prefix));
  if (!hit || started.has(hit[0])) return;
  started.add(hit[0]);
  hit[1]().catch(() => started.delete(hit[0])); // offline: allow a retry later
}

/** On a slow connection or with data saver on, do not spend the person's data. */
function connectionIsLight(): boolean {
  const c = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  return Boolean(c?.saveData) || c?.effectiveType === "slow-2g" || c?.effectiveType === "2g";
}

/** Quietly loads the most-used pages while the browser is idle. */
export function prefetchLikelyRoutes() {
  if (typeof window === "undefined" || connectionIsLight()) return;
  const run = () => {
    ["/messages", "/notifications", "/u/", "/posts/", "/news"].forEach((p, i) =>
      window.setTimeout(() => prefetchRoute(p), i * 400),
    );
  };
  const idle = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  ).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}
