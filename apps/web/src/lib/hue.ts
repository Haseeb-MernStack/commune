/**
 * Every person and community gets one colour from a fixed set, chosen from their name, so the
 * same name always looks the same everywhere. `fg` is the text colour that stays readable on it.
 */
export const HUES = [
  { bg: "#E5483A", fg: "#fff" }, // coral
  { bg: "#F59E0B", fg: "#2B1B00" }, // marigold
  { bg: "#178F5B", fg: "#fff" }, // leaf
  { bg: "#0E8F86", fg: "#fff" }, // teal
  { bg: "#1F7FE0", fg: "#fff" }, // sky
  { bg: "#7B4DE0", fg: "#fff" }, // violet
  { bg: "#D6407F", fg: "#fff" }, // pink
  { bg: "#E8701A", fg: "#2B1200" }, // tangerine
] as const;

export function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length]!;
}
