export type TextSize = "small" | "default" | "large";

export const TEXT_SIZE_KEY = "commune_text_size";

export const DEFAULT_TEXT_SIZE: TextSize = "default";

// Root font-size scale for each choice, mirroring the theme setting.
export const TEXT_SIZE_SCALES: Record<TextSize, number> = {
  small: 0.93,
  default: 1,
  large: 1.12,
};

export function parseTextSize(value: unknown): TextSize {
  if (value === "small" || value === "large") return value;
  return DEFAULT_TEXT_SIZE;
}

export function readTextSize(): TextSize {
  try {
    return parseTextSize(localStorage.getItem(TEXT_SIZE_KEY));
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

export function textSizeScale(size: TextSize): number {
  return TEXT_SIZE_SCALES[size];
}

export function applyTextSize(size: TextSize): void {
  try {
    document.documentElement.dataset.textSize = size;
  } catch {
    // Ignore, e.g. when the DOM is not available.
  }
}

export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    // Ignore, e.g. when storage is not available.
  }
  applyTextSize(size);
}
