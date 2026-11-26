import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTextSizePreference, getTextSizePreference, TEXT_SIZE_STORAGE_KEY } from "./textSize";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-text-size");
  vi.restoreAllMocks();
});

describe("getTextSizePreference", () => {
  it("returns default when nothing is stored", () => {
    expect(getTextSizePreference()).toBe("default");
  });

  it("returns the stored preference", () => {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, "large");
    expect(getTextSizePreference()).toBe("large");
  });

  it("returns default for an unknown stored value", () => {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, "huge");
    expect(getTextSizePreference()).toBe("default");
  });

  it("returns default when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(getTextSizePreference()).toBe("default");
  });
});

describe("applyTextSizePreference", () => {
  it("saves the preference and sets data-text-size on the page", () => {
    expect(applyTextSizePreference("small")).toBe("small");
    expect(window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe("small");
    expect(document.documentElement.dataset.textSize).toBe("small");
  });

  it("still applies the size when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(applyTextSizePreference("large")).toBe("large");
    expect(document.documentElement.dataset.textSize).toBe("large");
    expect(window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBeNull();
  });
});
