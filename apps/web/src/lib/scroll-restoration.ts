import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Saved scroll positions, keyed by the history entry (location.key). A back
 * navigation returns to the same entry, so the position saved when leaving it
 * is the one to restore. The app uses the component router (<Routes>), so
 * React Router's <ScrollRestoration> (data routers only) does not apply.
 */
const savedPositions = new Map<string, number>();

export function saveScrollPosition(key: string, y: number): void {
  savedPositions.set(key, y);
}

export function readScrollPosition(key: string): number | undefined {
  return savedPositions.get(key);
}

/** Clears the saved positions; used by tests so one test cannot see another's. */
export function clearSavedScrollPositions(): void {
  savedPositions.clear();
}

/**
 * Restores the feed's scroll position on back navigation, once the posts have
 * rendered, and starts a new page at the top. The restore runs in a layout
 * effect so the page never paints at the top first.
 *
 * Pass the feed query's isSuccess as `ready`: restoring before the posts
 * render would scroll to a position the content does not reach yet.
 */
export function useFeedScrollRestoration(ready: boolean): void {
  const location = useLocation();
  const navigationType = useNavigationType();
  const restoredKeyRef = useRef<string | null>(null);

  // A new page starts at the top right away, before its content loads.
  useLayoutEffect(() => {
    if (navigationType !== "PUSH") return;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, [location.key, navigationType]);

  // Back to this feed: restore the saved position once the posts rendered.
  useLayoutEffect(() => {
    if (!ready || navigationType !== "POP" || restoredKeyRef.current === location.key) return;
    restoredKeyRef.current = location.key;
    window.history.scrollRestoration = "manual";
    const y = readScrollPosition(location.key);
    if (y !== undefined) window.scrollTo(0, y);
  }, [ready, location.key, navigationType]);

  // Remember where the reader was when leaving this feed.
  useEffect(() => {
    const key = location.key;
    return () => saveScrollPosition(key, window.scrollY);
  }, [location.key]);
}
