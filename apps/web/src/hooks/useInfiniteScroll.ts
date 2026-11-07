import { useEffect, useRef } from "react";

/**
 * Loads the next page BEFORE the reader reaches the end of the list (800px early), so scrolling
 * feels endless. Put the returned ref on an empty element after the list.
 * `enabled` should be true only when there is a next page and none is loading right now; when it
 * turns true again after a page arrives, the check runs again, so short pages keep filling.
 */
export function useLoadMoreOnVisible(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callback.current();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
