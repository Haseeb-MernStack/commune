/**
 * Unread count shown in the browser tab title, "(3) Messages · Commune", and on the installed app's
 * icon where the browser supports it. Both are cleared when the count is zero.
 */
let baseTitle = typeof document === "undefined" ? "Commune" : document.title;
let count = 0;

const prefix = () => (count > 0 ? `(${count > 99 ? "99+" : count}) ` : "");

/** The page's own title (without the count). Call this instead of setting `document.title`. */
export function setBaseTitle(title: string): void {
  baseTitle = title;
  document.title = prefix() + baseTitle;
}

export function setBadgeCount(next: number): void {
  const n = Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  if (n === count) return;
  count = n;
  document.title = prefix() + baseTitle;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    void (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => undefined);
  } catch {
    /* not supported here: the title still shows the count */
  }
}
