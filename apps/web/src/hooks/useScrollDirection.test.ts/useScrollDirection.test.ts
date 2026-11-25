import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScrollDirection } from "./useScrollDirection";

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

function scrollTo(y: number) {
  setScrollY(y);
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("useScrollDirection", () => {
  it("starts as up", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe("up");
  });

  it("turns down after scrolling past the threshold", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    scrollTo(50);
    expect(result.current).toBe("down");
  });

  it("ignores moves smaller than the threshold", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    scrollTo(5);
    expect(result.current).toBe("up");
  });

  it("turns back up when scrolling up past the threshold", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    scrollTo(50);
    expect(result.current).toBe("down");
    scrollTo(20);
    expect(result.current).toBe("up");
  });

  it("always reports up at the top of the page", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    scrollTo(50);
    expect(result.current).toBe("down");
    scrollTo(0);
    expect(result.current).toBe("up");
  });

  it("does not flip on a small jitter while scrolling down", () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollDirection());
    scrollTo(100);
    expect(result.current).toBe("down");
    scrollTo(95);
    expect(result.current).toBe("down");
  });
});
