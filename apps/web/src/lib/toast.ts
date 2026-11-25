import { useSyncExternalStore } from "react";

/** A small banner for something that just happened, such as a new message. */
export interface Toast {
  id: number;
  title: string;
  body: string;
  /** A page on this site, opened when the banner is tapped. */
  to?: string;
  /** A button on the banner, such as Undo. Pressing it also dismisses the banner. */
  action?: { label: string; onClick: () => void };
}

const SHOWN_MS = 5000;
const MAX_SHOWN = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Shows a banner for a few seconds and returns its id. */
export function showToast(input: Omit<Toast, "id">): number {
  const id = nextId++;
  // The same conversation replaces its own banner instead of stacking up.
  const others = input.to ? toasts.filter((t) => t.to !== input.to) : toasts;
  toasts = [...others, { ...input, id }].slice(-MAX_SHOWN);
  emit();
  window.setTimeout(() => dismissToast(id), SHOWN_MS);
  return id;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
}
