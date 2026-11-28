import { showToast } from "./toast";

export interface CopyLinkOptions {
  /** Relative app route used to build the URL (when `url` is omitted) and link the toast. */
  to?: string;
  /** Full URL to copy. Defaults to `${window.location.origin}${to}`. */
  url?: string;
  /** Toast description shown after copying the link. */
  copiedBody?: string;
}

export interface ShareContentOptions extends CopyLinkOptions {
  /** Title passed to the native share sheet. */
  title: string;
  /** Optional body text passed to the native share sheet. */
  text?: string;
}

function resolveUrl({ to, url }: Pick<CopyLinkOptions, "to" | "url">): string {
  if (url) return url;
  return `${window.location.origin}${to ?? ""}`;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "AbortError"
  );
}

/** Copies a link to the clipboard and shows toast feedback. */
export async function copyLink({
  to,
  url,
  copiedBody = "Share this link with anyone.",
}: CopyLinkOptions): Promise<boolean> {
  const targetUrl = resolveUrl({ to, url });
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard is not available");
    }
    await navigator.clipboard.writeText(targetUrl);
    showToast({ title: "Link copied", body: copiedBody, to });
    return true;
  } catch {
    showToast({
      title: "Could not copy the link",
      body: "Copy this page's address from the address bar instead.",
      to,
    });
    return false;
  }
}

/**
 * Opens the native share sheet when available, ignoring user cancellation (`AbortError`),
 * and falls back to copying the link with toast feedback.
 */
export async function shareContent({
  title,
  text,
  to,
  url,
  copiedBody,
}: ShareContentOptions): Promise<void> {
  const targetUrl = resolveUrl({ to, url });
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title,
        url: targetUrl,
        ...(text !== undefined ? { text } : {}),
      });
      return;
    } catch (err) {
      // Closing the share sheet is not an error; any other failure falls back to copying.
      if (isAbortError(err)) return;
    }
  }
  await copyLink({ to, url: targetUrl, copiedBody });
}

/** Alias for sharing a URL via the native share sheet with clipboard fallback. */
export const shareUrl = shareContent;
