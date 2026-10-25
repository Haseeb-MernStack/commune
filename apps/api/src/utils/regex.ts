/** Escapes text so it can be embedded in a RegExp as a literal (no user-supplied patterns). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
