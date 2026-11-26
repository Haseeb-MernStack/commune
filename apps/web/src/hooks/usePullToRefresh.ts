import { useEffect, useRef, useState } from "react";

/** How far down the finger must travel before letting go refreshes the feed. */
const TRIGGER_DISTANCE = 72;

/** Full height of the pull indicator, in pixels. */
const INDICATOR_HEIGHT = 48;

/**
 * Pull to refresh for the installed app (PWA) mode, where the browser's own
 * pull-to-refresh does not run. In a normal browser tab the hook does nothing,
 * so it never fights the browser's own refresh.
 *
 * Only a touch that starts while the page is scrolled to the top can pull:
 * anything else is a normal scroll and is left alone. A second finger, a
 * sideways swipe or a swipe back up cancels the pull. While pulling, the page
 * does not rubber-band; letting go past the trigger distance calls `onRefresh`.
 * The indicator follows the finger with some resistance; with reduced motion
 * the spinner does not turn (see the pull-refresh styles).
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const refreshingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!installed) return;

    const reset = () => {
      startRef.current = null;
      if (pullRef.current > 0) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = startRef.current;
      if (start === null) return;
      if (e.touches.length !== 1) {
        reset();
        return;
      }
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
        reset();
        return;
      }
      e.preventDefault();
      pullRef.current = dy;
      setPull(dy);
    };

    const onTouchEnd = () => {
      const distance = pullRef.current;
      reset();
      if (distance < TRIGGER_DISTANCE || refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      void refreshRef.current().finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      });
    };

    const onTouchCancel = () => reset();

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  return {
    pull,
    refreshing,
    ready: pull >= TRIGGER_DISTANCE,
    indicatorHeight: refreshing ? INDICATOR_HEIGHT : Math.min(pull * 0.5, INDICATOR_HEIGHT),
  };
}
