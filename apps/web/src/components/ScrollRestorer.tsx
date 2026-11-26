import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** How long a Back keeps trying while the page grows tall enough (lazy pages, images). */
const RESTORE_TIMEOUT_MS = 1000;

/** Scroll position of each history entry this tab visited, by React Router's location key. */
const positions = new Map<string, number>();

/**
 * Back and Forward return to where the page was; any other navigation starts at the top.
 *
 * The app uses `BrowserRouter`, so React Router's `<ScrollRestoration>` (data routers only) is not
 * available, and the browser's own restoration runs before the feed has rendered and ends up at
 * the top. This takes over: the position is recorded per history entry while scrolling, and on a
 * Back it is restored before paint, retrying for a moment while the page is still too short.
 */
export default function ScrollRestorer() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Keep the current entry's position up to date, so leaving it never records the next page's.
  useEffect(() => {
    const key = location.key;
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.key]);

  useLayoutEffect(() => {
    if (navigationType !== "POP") {
      // A hash link scrolls to its target on its own; everything else starts at the top.
      if (!location.hash) window.scrollTo(0, 0);
      return;
    }
    const target = positions.get(location.key) ?? 0;
    const startedAt = performance.now();
    let frame = 0;
    const restore = () => {
      window.scrollTo(0, target);
      const reached = Math.abs(window.scrollY - target) < 2;
      if (!reached && performance.now() - startedAt < RESTORE_TIMEOUT_MS) {
        frame = requestAnimationFrame(restore);
      }
    };
    restore();
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, navigationType]);

  return null;
}
