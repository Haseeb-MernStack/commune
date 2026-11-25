import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

/**
 * Tells one tap from two quick ones, with a mouse and on touch screens (phones do not reliably
 * send "double click"). Use the result as an `onClick`.
 *
 * - Two clicks within `ms` call `onDouble`.
 * - `onSingle` (optional) runs after the wait when there was only one click. When it is given, the
 *   browser's own action for that click (such as following a link) is held back and `onSingle`
 *   does it instead, so a double tap does not do both.
 * - Clicks with Ctrl, Cmd, Shift, Alt or a non-primary button, and clicks on a link or button
 *   inside the element, are left alone.
 */
export function useDoubleTap(onDouble: () => void, onSingle?: () => void, ms = 280) {
  const last = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (event: MouseEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    const inner = (event.target as HTMLElement).closest("a, button");
    if (inner && inner !== event.currentTarget) return;

    const now = Date.now();
    if (now - last.current <= ms) {
      window.clearTimeout(timer.current);
      last.current = 0;
      event.preventDefault();
      onDouble();
      return;
    }
    last.current = now;
    if (onSingle) {
      event.preventDefault();
      timer.current = window.setTimeout(onSingle, ms);
    }
  };
}
