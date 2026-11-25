import { useSyncExternalStore } from "react";

/**
 * Posts deleted with an Undo window. A post is hidden at once and the delete is sent only when
 * the window ends, so Undo just shows it again in the same place: nothing was removed yet.
 *
 * The timers live here, not in a component, so they keep running when the post's card unmounts
 * or the person moves to another page. If the tab is closed or reloaded during the window, the
 * delete is sent right away with `keepalive` (see `flushPendingDeletes`): the person chose Delete
 * and did not press Undo, so leaving the page counts as "keep the delete".
 */

export const UNDO_WINDOW_MS = 5000;

type Send = (options: { keepalive: boolean }) => Promise<unknown>;

interface Pending {
  timer: number;
  send: Send;
  onError: (error: unknown) => void;
}

const pending = new Map<string, Pending>();
let hidden: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setHidden(id: string, on: boolean) {
  const next = new Set(hidden);
  if (on) next.add(id);
  else next.delete(id);
  hidden = next;
  listeners.forEach((l) => l());
}

function commit(id: string, keepalive: boolean) {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  window.clearTimeout(entry.timer);
  entry.send({ keepalive }).catch((error: unknown) => {
    // The post was not deleted: bring it back where it was, and say so.
    setHidden(id, false);
    entry.onError(error);
  });
}

/** Hides a post now and deletes it when the Undo window ends. Calling it twice does nothing. */
export function scheduleDelete(
  id: string,
  send: Send,
  onError: (error: unknown) => void,
  ms = UNDO_WINDOW_MS,
): void {
  if (pending.has(id)) return;
  const timer = window.setTimeout(() => commit(id, false), ms);
  pending.set(id, { timer, send, onError });
  setHidden(id, true);
}

/** Cancels a scheduled delete and shows the post again. False if it was already sent. */
export function undoDelete(id: string): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  window.clearTimeout(entry.timer);
  pending.delete(id);
  setHidden(id, false);
  return true;
}

/** Sends every scheduled delete now, for a page that is going away. */
export function flushPendingDeletes(): void {
  for (const id of [...pending.keys()]) commit(id, true);
}

if (typeof window !== "undefined") window.addEventListener("pagehide", flushPendingDeletes);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Ids of posts hidden while their delete is pending (or after it was sent). */
export function useHiddenPosts(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => hidden,
  );
}
