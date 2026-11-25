import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDoubleTap } from "./useDoubleTap";

const click = (over: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: document.createElement("p"),
    currentTarget: document.createElement("p"),
    preventDefault: vi.fn(),
    ...over,
  }) as unknown as MouseEvent & { preventDefault: ReturnType<typeof vi.fn> };

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe("useDoubleTap", () => {
  it("calls onDouble for two quick clicks, and not onSingle", () => {
    const onDouble = vi.fn();
    const onSingle = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDouble, onSingle));
    const first = click();
    const second = click();
    act(() => result.current(first));
    vi.advanceTimersByTime(100);
    act(() => result.current(second));
    vi.advanceTimersByTime(1000);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
    expect(second.preventDefault).toHaveBeenCalled();
  });

  it("runs onSingle after the wait when there is only one click", () => {
    const onDouble = vi.fn();
    const onSingle = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDouble, onSingle));
    const e = click();
    act(() => result.current(e));
    expect(onSingle).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("does not hold back a single click when there is no onSingle", () => {
    const { result } = renderHook(() => useDoubleTap(vi.fn()));
    const e = click();
    act(() => result.current(e));
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("treats two slow clicks as two single clicks", () => {
    const onDouble = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDouble));
    act(() => result.current(click()));
    vi.advanceTimersByTime(600);
    act(() => result.current(click()));
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("leaves modifier clicks, other buttons and inner links alone", () => {
    const onDouble = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDouble, vi.fn()));
    const link = document.createElement("a");
    const inside = click({ target: link });
    for (const e of [
      click({ ctrlKey: true }),
      click({ metaKey: true }),
      click({ button: 1 }),
      inside,
    ]) {
      act(() => result.current(e));
      act(() => result.current(e));
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(onDouble).not.toHaveBeenCalled();
  });
});
