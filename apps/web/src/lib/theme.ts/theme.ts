// Theme preference helpers. The choice is stored in localStorage so it survives
// reloads, and applied to the <html> element before first paint by the inline
// script in apps/web/index.html, which mirrors this logic. Keep the two in sync.

/** The theme choices offered in Settings. "system" follows the OS setting. */
export type ThemePreference = "system" | "light" | "dark";

/** The theme that is actually shown on screen. */
export type ResolvedTheme = "light" | "dark";

/** localStorage key for the saved theme preference. */
export const THEME_STORAGE_KEY = "commune_theme";

/** Page background for each resolved theme, matching --bg in styles/theme.css. */
export const THEME_BACKGROUNDS: Record<ResolvedTheme, string> = {
  light: "#f3f4f9",
  dark: "#0b0d13",
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** Read the saved theme preference. Falls back to "system" when nothing is
 * saved, the value is unknown, or storage is unavailable (for example when
 * the browser blocks it). */
export function getThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Whether the OS currently prefers a dark theme. */
export function prefersDarkTheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve a preference to the theme that should be shown right now. */
export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return prefersDarkTheme() ? "dark" : "light";
  }
  return preference;
}

/**
 * Save a theme preference and apply it to the page: set data-theme on
 * <html> (styles/theme.css switches its tokens on it), and update the
 * theme-color and color-scheme meta tags so the browser chrome matches.
 * Storage is best effort: when it is blocked the theme still applies for
 * this visit. Returns the resolved theme that was applied.
 */
export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveThemePreference(preference);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
  const root = document.documentElement;
  root.dataset.theme = resolved;
  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (themeColor) {
    themeColor.content = THEME_BACKGROUNDS[resolved];
  }
  const colorScheme = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (colorScheme) {
    colorScheme.content = resolved;
  }
  return resolved;
}

/**
 * Call `onChange` whenever the OS theme changes. The caller keeps the
 * subscription while "system" is selected. Returns an unsubscribe function.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  try {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      onChange();
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
      return () => {
        query.removeEventListener("change", listener);
      };
    }
    // Older browsers only support the deprecated listener API.
    query.addListener(listener);
    return () => {
      query.removeListener(listener);
    };
  } catch {
    return () => {};
  }
}
