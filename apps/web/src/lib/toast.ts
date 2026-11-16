import { useSyncExternalStore } from "react";

/** A small banner for something that just happened, such as a new message. */
export interface Toast {
  id: number;
  title: string;
  body: string;
  /** A page on this site, opened when the banner is tapped. */
  to: string;
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

export function showToast(input: Omit<Toast, "id">): void {
  const id = nextId++;
  // The same conversation replaces its own banner instead of stacking up.
  toasts = [...toasts.filter((t) => t.to !== input.to), { ...input, id }].slice(-MAX_SHOWN);
  emit();
  window.setTimeout(() => dismissToast(id), SHOWN_MS);
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
