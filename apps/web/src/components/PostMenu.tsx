import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Icon, { type IconName } from "./Icon";

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const PHONE = "(max-width: 640px)";

/**
 * The "three dots" menu on a post. On a laptop it is a small popover next to the button; on a
 * phone it slides up from the bottom as a sheet with large tap targets. It is drawn in a portal
 * so a post's own clipping never cuts it off. Keyboard: Enter or Down opens it, Up and Down move,
 * Home and End jump, Esc closes and returns focus to the button.
 */
export default function PostMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties | undefined>();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  // Swipe the sheet down to close it on phones. The gesture starts on the
  // grab handle only, so scrolling the menu items still works.
  const drag = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    dy: number;
  } | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);

  const onDragMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = Math.max(0, e.clientY - d.startY);
    const dt = e.timeStamp - d.lastTime;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastTime = e.timeStamp;
    d.dy = dy;
    setDragY(dy);
  }, []);

  const onDragEnd = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    if (!d) return;
    // Close after a long drag, or a fast flick; otherwise snap back.
    if (d.dy > 80 || (d.dy > 24 && d.velocity > 0.5)) {
      setOpen(false);
    }
    setDragY(null);
  }, [onDragMove]);

  // Drop the listeners if the menu unmounts mid-drag.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  const onGrabPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    if (!window.matchMedia(PHONE).matches) return;
    drag.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      dy: 0,
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  };

  // Place the popover under the button, or above it when there is no room. Phones use the sheet.
  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    if (window.matchMedia(PHONE).matches) return setPos(undefined);
    const b = button.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    const below = b.bottom + 6 + m.height <= window.innerHeight - 8;
    const top = below ? b.bottom + 6 : Math.max(8, b.top - m.height - 6);
    const left = Math.min(Math.max(8, b.right - m.width), window.innerWidth - m.width - 8);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    const away = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", away, { passive: true, capture: true });
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", away, { capture: true });
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      return close(true);
    }
    if (e.key === "Tab") return close(false);
    const all = [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === "ArrowDown"
        ? (at + 1) % all.length
        : e.key === "ArrowUp"
          ? (at - 1 + all.length) % all.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? all.length - 1
              : -1;
    if (to >= 0) {
      e.preventDefault();
      all[to]?.focus();
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="ig-icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name="dots" size={24} filled />
      </button>
      {open &&
        createPortal(
          <>
            <div className="menu-backdrop" onClick={() => close(false)} aria-hidden="true" />
            <div
              ref={menu}
              id={id}
              role="menu"
              aria-label={label}
              className="post-menu"
              style={{
              ...pos,
              transform: dragY === null ? undefined : `translateY(${dragY}px)`,
              transition: dragY === null ? undefined : "none",
            }}
              onKeyDown={onMenuKey}
            >
              <span className="menu-grab" aria-hidden="true" onPointerDown={onGrabPointerDown} />
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`menu-item${item.danger ? " danger" : ""}`}
                  disabled={item.disabled}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
