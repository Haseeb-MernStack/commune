import { describe, expect, it, vi } from "vitest";
import { copyPageLink, sharePage } from "./share";

describe("sharePage", () => {
  it("uses the share sheet when it exists", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    await sharePage({
      to: "/u/alice",
      title: "@alice on Commune",
      copiedBody: "Share this profile with anyone.",
    });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      text: undefined,
      url: `${window.location.origin}/u/alice`,
    });
  });

  it("ignores AbortError when the sheet is closed", async () => {
    const share = vi.fn().mockRejectedValue(
      Object.assign(new Error("Closed"), { name: "AbortError" }),
    );
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await sharePage({
      to: "/u/alice",
      title: "@alice on Commune",
      copiedBody: "Share this profile with anyone.",
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when there is no share sheet", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await sharePage({
      to: "/u/alice",
      title: "@alice on Commune",
      copiedBody: "Share this profile with anyone.",
    });
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/u/alice`,
    );
  });

  it("copies the link when sharing fails for another reason", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share failed"));
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await sharePage({
      to: "/u/alice",
      title: "@alice on Commune",
      copiedBody: "Share this profile with anyone.",
    });
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

describe("copyPageLink", () => {
  it("writes the absolute URL to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await copyPageLink("/u/alice", "Share this profile with anyone.");
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/u/alice`,
    );
  });
});
