import type { ReactNode } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Splits text by the words in the query (case-insensitive) and wraps each
// match in <mark>. The text stays escaped by React and this never uses
// dangerouslySetInnerHTML. Special characters in the query are escaped
// first, so they cannot break the pattern.
export function highlightText(text: string, query: string): ReactNode {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  const lowerTerms = new Set(terms.map((term) => term.toLowerCase()));
  return parts.map((part, index) =>
    lowerTerms.has(part.toLowerCase()) ? <mark key={index}>{part}</mark> : part,
  );
}
