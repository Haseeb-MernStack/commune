/**
 * Password-reset and email-confirmation links carry a secret in the address. index.html moves it
 * out of the address bar before any third-party script (analytics, ads) loads, so it cannot be
 * read from the URL, the history or a Referer header. It waits here for this tab only.
 */
const KEY = "commune_link_token";

export function readLinkToken(fallback = ""): string {
  try {
    return sessionStorage.getItem(KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function clearLinkToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
