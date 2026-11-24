import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeSettings from "./ThemeSettings";
import { THEME_BACKGROUNDS, THEME_STORAGE_KEY } from "../lib/theme";

// The OS theme in these tests is driven by a stubbed matchMedia, so the
// component's System choice can be checked without a real OS setting.
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

describe("ThemeSettings", () => {
  it("checks the saved choice on mount", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSettings />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
  });

  it("saves the choice and applies it when a different option is picked", async () => {
    const user = userEvent.setup();
    render(<ThemeSettings />);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("follows the OS theme live while System is selected", async () => {
    const user = userEvent.setup();
    setOsTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeSettings />);
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    setOsTheme(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
