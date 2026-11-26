import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tap } from "./haptics";

const originalMatchMedia = window.matchMedia;
let prefersReducedMotion = false;
let vibrate = vi.fn();

beforeEach(() => {
  prefersReducedMotion = false;
  vibrate = vi.fn();
  window.matchMedia = () => ({ matches: prefersReducedMotion }) as unknown as MediaQueryList;
  vi.stubGlobal("navigator", { vibrate });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tap", () => {
  it("vibrates once for 10ms", () => {
    tap();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("does nothing when reduced motion is preferred", () => {
    prefersReducedMotion = true;
    tap();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does nothing when vibrate is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(() => tap()).not.toThrow();
  });
});
