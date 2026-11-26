// Text size preference helpers. Mirrors lib/theme.ts: the choice is stored in localStorage and
// applied to <html> as data-text-size before first paint by the inline script in
// apps/web/index.html. Keep the two in sync.

export type TextSizePreference = "small" | "default" | "large";

export const TEXT_SIZE_STORAGE_KEY = "commune_text_size";

function isTextSizePreference(value: unknown): value is TextSizePreference {
  return value === "small" || value === "default" || value === "large";
}

/** Read the saved choice. Falls back to "default" when nothing valid is saved or storage is blocked. */
export function getTextSizePreference(): TextSizePreference {
  try {
    const stored = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return isTextSizePreference(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

/**
 * Save the choice and apply it by setting data-text-size on <html> (styles/theme.css scales the
 * root font size from it). Storage is best effort: when blocked, the size still applies for this
 * visit.
 */
export function applyTextSizePreference(preference: TextSizePreference): TextSizePreference {
  try {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the size still applies for this visit.
  }
  document.documentElement.dataset.textSize = preference;
  return preference;
}
