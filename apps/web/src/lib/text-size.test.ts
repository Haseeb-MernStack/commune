import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyTextSize,
  DEFAULT_TEXT_SIZE,
  parseTextSize,
  readTextSize,
  setTextSize,
  TEXT_SIZE_KEY,
  textSizeScale,
} from "./text-size";

describe("text size", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-text-size");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-text-size");
  });

  it("defaults to Default when nothing is stored", () => {
    expect(readTextSize()).toBe(DEFAULT_TEXT_SIZE);
    expect(readTextSize()).toBe("default");
  });

  it("reads a stored choice and falls back for an unknown value", () => {
    localStorage.setItem(TEXT_SIZE_KEY, "large");
    expect(readTextSize()).toBe("large");
    localStorage.setItem(TEXT_SIZE_KEY, "huge");
    expect(readTextSize()).toBe("default");
  });

  it("parses only small and large, everything else is Default", () => {
    expect(parseTextSize("small")).toBe("small");
    expect(parseTextSize("large")).toBe("large");
    expect(parseTextSize("default")).toBe("default");
    expect(parseTextSize("bogus")).toBe("default");
    expect(parseTextSize(undefined)).toBe("default");
  });

  it("scales the root font size to 93% and 112%", () => {
    expect(textSizeScale("small")).toBe(0.93);
    expect(textSizeScale("default")).toBe(1);
    expect(textSizeScale("large")).toBe(1.12);
  });

  it("applies the choice to the document element", () => {
    applyTextSize("small");
    expect(document.documentElement.dataset.textSize).toBe("small");
  });

  it("stores the choice and applies it", () => {
    setTextSize("large");
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe("large");
    expect(document.documentElement.dataset.textSize).toBe("large");
  });
});
