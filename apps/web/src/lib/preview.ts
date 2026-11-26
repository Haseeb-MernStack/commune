/** A post stays collapsed only when it is longer than this many words, lines or characters. */
export const PREVIEW_MAX_WORDS = 20;
export const PREVIEW_MAX_LINES = 3;
export const PREVIEW_MAX_CHARS = 240;

export interface Preview {
  /** The text to show while collapsed. Equals the full text when nothing was cut. */
  text: string;
  /** True when the text was shortened, so a "more" control is needed. */
  truncated: boolean;
}

/**
 * Cuts a long post down to a short preview, always at a word boundary so a web address is never
 * split in half. Short posts come back untouched, so they never show a "more" control.
 */
export function previewText(full: string): Preview {
  let end = full.length;

  // Lines: stop at the start of the line after the allowed ones.
  let newlines = 0;
  for (let i = 0; i < full.length; i++) {
    if (full[i] === "\n" && ++newlines === PREVIEW_MAX_LINES) {
      if (full.slice(i + 1).trim() !== "") end = Math.min(end, i);
      break;
    }
  }

  // Words: stop after the last allowed word.
  let words = 0;
  for (const match of full.matchAll(/\S+/g)) {
    if (++words > PREVIEW_MAX_WORDS) {
      end = Math.min(end, match.index ?? end);
      break;
    }
  }

  // Characters: back up to the last space so a word is not cut in two (hard cut for one huge word).
  if (end > PREVIEW_MAX_CHARS) {
    const space = full.lastIndexOf(" ", PREVIEW_MAX_CHARS);
    end = space > 0 ? space : PREVIEW_MAX_CHARS;
  }

  if (end >= full.length) return { text: full, truncated: false };
  return { text: full.slice(0, end).trimEnd(), truncated: true };
}
