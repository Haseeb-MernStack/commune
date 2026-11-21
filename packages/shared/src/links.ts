/**
 * Finds web links in plain user text so the web app can render them as real links.
 * Only http and https links are recognised. Anything else (javascript:, data:, mailto:) stays plain
 * text, as do links that hide their real host behind a user name (https://bank.com@evil.com).
 */
export type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string; label: string };

const CANDIDATE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const MAX_URL_LENGTH = 2048;
const MAX_LABEL_LENGTH = 42;

/** Removes punctuation that belongs to the sentence, not the link: "see https://a.com/x)." */
function trimTrailing(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1]!;
    if (".,;:!?'\"".includes(ch)) {
      end--;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      const open = ch === ")" ? "(" : ch === "]" ? "[" : "{";
      const body = url.slice(0, end);
      const opens = body.split(open).length - 1;
      const closes = body.split(ch).length - 1;
      if (closes > opens) end--;
      else break;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

/** A short, readable label: no protocol, no "www.", no trailing slash, shortened when long. */
function labelFor(url: URL): string {
  const path = url.pathname === "/" ? "" : url.pathname;
  let label = url.host.replace(/^www\./i, "") + path + url.search + url.hash;
  label = label.replace(/\/$/, "");
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

/** Returns the safe https/http address for a candidate, or null if it should stay plain text. */
function toSafeUrl(candidate: string): URL | null {
  if (candidate.length > MAX_URL_LENGTH) return null;
  const withScheme = /^www\./i.test(candidate) ? `https://${candidate}` : candidate;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url;
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index ?? 0;
    const raw = trimTrailing(match[0]);
    const url = raw ? toSafeUrl(raw) : null;
    if (!url) continue;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value: raw, href: url.href, label: labelFor(url) });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
