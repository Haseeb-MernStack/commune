import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyThemePreference,
  getThemePreference,
  resolveThemePreference,
  THEME_BACKGROUNDS,
  THEME_STORAGE_KEY,
  watchSystemTheme,
} from "./theme";

// The OS theme in these tests is driven by a stubbed matchMedia. The stub
// keeps the current value in `osPrefersDark` and hands every listener to
// `osChangeListener`, so a test can flip the OS theme and fire the change.
let osPrefersDark = false;
let osChangeListener: (() => void) | null = null;

const mediaQueryStub = {
  get matches() {
    return osPrefersDark;
  },
  addEventListener: vi.fn((_type: string, listener: () => void) => {
    osChangeListener = listener;
  }),
  removeEventListener: vi.fn((_type: string, listener: () => void) => {
    if (osChangeListener === listener) {
      osChangeListener = null;
    }
  }),
  addListener: vi.fn((listener: () => void) => {
    osChangeListener = listener;
  }),
  removeListener: vi.fn((listener: () => void) => {
    if (osChangeListener === listener) {
      osChangeListener = null;
    }
  }),
};

const originalMatchMedia = window.matchMedia;

function setOsTheme(dark: boolean) {
  osPrefersDark = dark;
  osChangeListener?.();
}

function themeColorMeta() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

function colorSchemeMeta() {
  return document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
}

beforeEach(() => {
  window.matchMedia = () => mediaQueryStub as unknown as MediaQueryList;
  const themeColor = document.createElement("meta");
  themeColor.name = "theme-color";
  themeColor.content = THEME_BACKGROUNDS.light;
  document.head.appendChild(themeColor);
  const colorScheme = document.createElement("meta");
  colorScheme.name = "color-scheme";
  colorScheme.content = "light dark";
  document.head.appendChild(colorScheme);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.localStorage.clear();
  document.head.querySelectorAll("meta").forEach((meta) => meta.remove());
  document.documentElement.removeAttribute("data-theme");
  osPrefersDark = false;
  osChangeListener = null;
  vi.restoreAllMocks();
});

describe("getThemePreference", () => {
  it("returns system when nothing is stored", () => {
    expect(getThemePreference()).toBe("system");
  });

  it("returns the stored preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getThemePreference()).toBe("dark");
  });

  it("returns system for an unknown stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(getThemePreference()).toBe("system");
  });

  it("returns system when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(getThemePreference()).toBe("system");
  });
});

describe("resolveThemePreference", () => {
  it("returns light and dark as they are", () => {
    expect(resolveThemePreference("light")).toBe("light");
    expect(resolveThemePreference("dark")).toBe("dark");
  });

  it("follows the OS theme when the preference is system", () => {
    setOsTheme(false);
    expect(resolveThemePreference("system")).toBe("light");
    setOsTheme(true);
    expect(resolveThemePreference("system")).toBe("dark");
  });
});

describe("applyThemePreference", () => {
  it("saves the preference and applies the dark theme to the page", () => {
    expect(applyThemePreference("dark")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeColorMeta()?.content).toBe(THEME_BACKGROUNDS.dark);
    expect(colorSchemeMeta()?.content).toBe("dark");
  });

  it("resolves system to the OS theme", () => {
    setOsTheme(false);
    expect(applyThemePreference("system")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(themeColorMeta()?.content).toBe(THEME_BACKGROUNDS.light);
    expect(colorSchemeMeta()?.content).toBe("light");
  });

  it("still applies the theme when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(applyThemePreference("dark")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe("watchSystemTheme", () => {
  it("calls onChange when the OS theme changes", () => {
    const onChange = vi.fn();
    watchSystemTheme(onChange);
    setOsTheme(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    setOsTheme(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("stops calling onChange after unsubscribe", () => {
    const onChange = vi.fn();
    const unsubscribe = watchSystemTheme(onChange);
    unsubscribe();
    setOsTheme(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("returns a harmless unsubscribe when matchMedia is unavailable", () => {
    window.matchMedia = () => {
      throw new Error("matchMedia is not available");
    };
    const unsubscribe = watchSystemTheme(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});
