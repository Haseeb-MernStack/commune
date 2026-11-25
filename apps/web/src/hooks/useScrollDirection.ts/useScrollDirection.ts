import { useEffect, useState } from "react";

export type ScrollDirection = "up" | "down";

/**
 * Reports whether the page is being scrolled down ("down") or up ("up").
 *
 * The direction only flips after the page has moved more than `threshold`
 * pixels in one direction, so small jitters — for example from the iPhone
 * address bar collapsing — do not flicker it. At the very top of the page
 * the direction is always "up".
 */
export function useScrollDirection(threshold = 10): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("up");

  useEffect(() => {
    let lowY = window.scrollY;
    let highY = window.scrollY;
    let current: ScrollDirection = "up";

    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 0) {
        lowY = 0;
        highY = 0;
        if (current !== "up") {
          current = "up";
          setDirection("up");
        }
        return;
      }
      if (current === "up") {
        lowY = Math.min(lowY, y);
        if (y > lowY + threshold) {
          current = "down";
          highY = y;
          setDirection("down");
        }
      } else {
        highY = Math.max(highY, y);
        if (y < highY - threshold) {
          current = "up";
          lowY = y;
          setDirection("up");
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}
