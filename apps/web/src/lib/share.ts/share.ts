import { showToast } from "./toast";

export interface SharePageOptions {
  /** The path of the page to share, such as "/posts/12" or "/u/alice". */
  to: string;
  /** The title shown in the share sheet. */
  title: string;
  /** Optional text included in the share sheet. */
  text?: string;
  /** The body of the "Link copied" toast. */
  copiedBody: string;
}

/** Copies a page link to the clipboard and toasts the result. */
export async function copyPageLink(to: string, copiedBody: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard is not available");
    }
    await navigator.clipboard.writeText(`${window.location.origin}${to}`);
    showToast({ title: "Link copied", body: copiedBody, to });
  } catch {
    showToast({
      title: "Could not copy the link",
      body: "Copy this page's address from the address bar instead.",
      to,
    });
  }
}

/**
 * Shares a page with the phone's share sheet when it exists, otherwise copies
 * the link. Closing the sheet is not an error; any other failure falls back
 * to copying.
 */
export async function sharePage(options: SharePageOptions): Promise<void> {
  const url = `${window.location.origin}${options.to}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: options.title, text: options.text, url });
      return;
    } catch (err) {
      // Closing the share sheet is not an error; any other failure falls back to copying.
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  await copyPageLink(options.to, options.copiedBody);
}
