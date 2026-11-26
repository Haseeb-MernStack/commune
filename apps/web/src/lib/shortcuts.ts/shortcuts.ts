/** One list of the global keyboard shortcuts, used by the key handler and the help dialog. */

export interface Shortcut {
  /** The key to press, as KeyboardEvent.key reports it. */
  key: string;
  /** What the shortcut does. */
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: "?", description: "Show keyboard shortcuts" },
  { key: "n", description: "Write a new post" },
  { key: "/", description: "Search" },
];

/** True when the event target is a field the user is typing in, where shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Runs the shortcut for a keydown event, if any, and returns true when one
 * ran. The actions are supplied by the app (one per shortcut key), so this
 * file stays free of routing and DOM lookups. Shortcuts never fire while
 * the user is typing, while a modifier key is held, or while a modal dialog
 * is open.
 */
export function handleShortcutKey(
  e: KeyboardEvent,
  actions: Record<string, () => void>,
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isTypingTarget(e.target)) return false;
  if (document.querySelector("dialog[open]")) return false;
  const shortcut = SHORTCUTS.find((s) => s.key === e.key);
  if (!shortcut) return false;
  e.preventDefault();
  actions[shortcut.key]?.();
  return true;
}
