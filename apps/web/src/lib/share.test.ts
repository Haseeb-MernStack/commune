import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyLink, shareContent, shareUrl } from "./share";
import * as toast from "./toast";

describe("share helpers", () => {
  let showToastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    showToastSpy = vi.spyOn(toast, "showToast");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses navigator.share when available and omits undefined text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    await shareContent({
      title: "@alice on Commune",
      url: "https://commune.example/u/alice",
      to: "/u/alice",
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      url: "https://commune.example/u/alice",
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it("passes text to navigator.share when provided and exports shareUrl alias", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });

    expect(shareUrl).toBe(shareContent);

    await shareUrl({
      title: "@alice on Commune",
      text: "Hello world",
      to: "/posts/p1",
    });

    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      text: "Hello world",
      url: `${window.location.origin}/posts/p1`,
    });
  });

  it("ignores AbortError silently when the user closes the share sheet", async () => {
    const abortError = new DOMException("Share canceled", "AbortError");
    const share = vi.fn().mockRejectedValue(abortError);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    await shareContent({
      title: "@alice on Commune",
      url: "https://commune.example/u/alice",
      to: "/u/alice",
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it("falls back to copying to clipboard when navigator.share rejects with a non-AbortError", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share failed"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    await shareContent({
      title: "@alice on Commune",
      url: "https://commune.example/u/alice",
      to: "/u/alice",
      copiedBody: "Share this profile with anyone.",
    });

    expect(writeText).toHaveBeenCalledWith("https://commune.example/u/alice");
    expect(showToastSpy).toHaveBeenCalledWith({
      title: "Link copied",
      body: "Share this profile with anyone.",
      to: "/u/alice",
    });
  });

  it("copies the link and shows toast feedback when navigator.share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await shareContent({
      title: "@bob on Commune",
      to: "/u/bob",
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/u/bob`);
    expect(showToastSpy).toHaveBeenCalledWith({
      title: "Link copied",
      body: "Share this link with anyone.",
      to: "/u/bob",
    });
  });

  it("shows an error toast when clipboard is unavailable or writeText fails", async () => {
    vi.stubGlobal("navigator", {});

    const copied = await copyLink({ to: "/u/bob" });

    expect(copied).toBe(false);
    expect(showToastSpy).toHaveBeenCalledWith({
      title: "Could not copy the link",
      body: "Copy this page's address from the address bar instead.",
      to: "/u/bob",
    });
  });
});
