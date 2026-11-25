import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNDO_WINDOW_MS,
  flushPendingDeletes,
  scheduleDelete,
  undoDelete,
  useHiddenPosts,
} from "./pendingDeletes";

// The store is shared by the whole module, so every test uses its own post id.
let n = 0;
const nextId = () => `post-${++n}`;

describe("pending deletes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the post at once and sends the delete once, when the window ends", async () => {
    const id = nextId();
    const send = vi.fn().mockResolvedValue(undefined);
    const hidden = renderHook(() => useHiddenPosts());

    act(() => scheduleDelete(id, send, vi.fn()));
    // A second Delete during the window does not schedule another request.
    act(() => scheduleDelete(id, send, vi.fn()));
    expect(hidden.result.current.has(id)).toBe(true);

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ keepalive: false });

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(send).toHaveBeenCalledTimes(1);
    expect(hidden.result.current.has(id)).toBe(true);
  });

  it("Undo shows the post again and nothing is sent", async () => {
    const id = nextId();
    const send = vi.fn().mockResolvedValue(undefined);
    const hidden = renderHook(() => useHiddenPosts());

    act(() => scheduleDelete(id, send, vi.fn()));
    let undone = false;
    act(() => {
      undone = undoDelete(id);
    });

    expect(undone).toBe(true);
    expect(hidden.result.current.has(id)).toBe(false);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(send).not.toHaveBeenCalled();
    // Too late once it has been sent.
    expect(undoDelete(id)).toBe(false);
  });

  it("brings the post back and reports the error when the delete fails", async () => {
    const id = nextId();
    const error = new Error("Server error");
    const send = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const hidden = renderHook(() => useHiddenPosts());

    act(() => scheduleDelete(id, send, onError));
    await act(() => vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS));

    expect(onError).toHaveBeenCalledWith(error);
    expect(hidden.result.current.has(id)).toBe(false);
  });

  it("sends pending deletes with keepalive when the page goes away, and only once", async () => {
    const id = nextId();
    const send = vi.fn().mockResolvedValue(undefined);

    act(() => scheduleDelete(id, send, vi.fn()));
    window.dispatchEvent(new Event("pagehide"));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ keepalive: true });
    flushPendingDeletes();
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
