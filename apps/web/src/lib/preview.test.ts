import { describe, expect, it } from "vitest";
import { PREVIEW_MAX_CHARS, PREVIEW_MAX_WORDS, previewText } from "./preview";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i + 1}`).join(" ");

describe("previewText", () => {
  it("leaves a short post alone", () => {
    expect(previewText("Hi")).toEqual({ text: "Hi", truncated: false });
  });

  it("leaves a post of exactly the word limit alone", () => {
    const text = words(PREVIEW_MAX_WORDS);
    expect(previewText(text)).toEqual({ text, truncated: false });
  });

  it("cuts after the word limit", () => {
    const result = previewText(words(PREVIEW_MAX_WORDS + 5));
    expect(result.truncated).toBe(true);
    expect(result.text).toBe(words(PREVIEW_MAX_WORDS));
  });

  it("cuts a post with more than three lines", () => {
    const result = previewText("a\nb\nc\nd");
    expect(result).toEqual({ text: "a\nb\nc", truncated: true });
  });

  it("does not count trailing blank lines as more text", () => {
    expect(previewText("a\nb\nc\n  \n").truncated).toBe(false);
  });

  it("never cuts a web address in half", () => {
    const text = `${words(10)} https://example.com/${"x".repeat(300)} tail`;
    const result = previewText(text);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe(words(10));
  });

  it("hard cuts a single huge word", () => {
    const result = previewText("x".repeat(PREVIEW_MAX_CHARS * 2));
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(PREVIEW_MAX_CHARS);
  });
});
