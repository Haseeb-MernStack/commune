import { describe, expect, it } from "vitest";
import { splitLinks } from "@commune/shared";

describe("splitLinks", () => {
  it("turns a plain link into a link part", () => {
    expect(splitLinks("https://example.com")).toEqual([
      {
        type: "link",
        value: "https://example.com",
        href: "https://example.com/",
        label: "example.com",
      },
    ]);
  });

  it("keeps the text around a link inside a sentence", () => {
    expect(splitLinks("check https://example.com/path out")).toEqual([
      { type: "text", value: "check " },
      {
        type: "link",
        value: "https://example.com/path",
        href: "https://example.com/path",
        label: "example.com/path",
      },
      { type: "text", value: " out" },
    ]);
  });

  it("turns a www. address into an https link", () => {
    expect(splitLinks("visit www.example.com")).toEqual([
      { type: "text", value: "visit " },
      {
        type: "link",
        value: "www.example.com",
        href: "https://www.example.com/",
        label: "example.com",
      },
    ]);
  });

  it("drops a trailing full stop from a link", () => {
    expect(splitLinks("see https://example.com.")).toEqual([
      { type: "text", value: "see " },
      {
        type: "link",
        value: "https://example.com",
        href: "https://example.com/",
        label: "example.com",
      },
      { type: "text", value: "." },
    ]);
  });

  it("drops an unbalanced closing bracket from a link", () => {
    expect(splitLinks("(https://example.com)")).toEqual([
      { type: "text", value: "(" },
      {
        type: "link",
        value: "https://example.com",
        href: "https://example.com/",
        label: "example.com",
      },
      { type: "text", value: ")" },
    ]);
  });

  it("leaves a bare domain without a scheme as plain text", () => {
    expect(splitLinks("visit example.com.")).toEqual([
      { type: "text", value: "visit example.com." },
    ]);
  });

  it("rejects javascript: links", () => {
    expect(splitLinks("javascript:alert(1)")).toEqual([
      { type: "text", value: "javascript:alert(1)" },
    ]);
  });

  it("rejects data: links", () => {
    expect(splitLinks("data:text/html,hello")).toEqual([
      { type: "text", value: "data:text/html,hello" },
    ]);
  });

  it("rejects links with a username and password", () => {
    expect(splitLinks("https://user:pass@example.com")).toEqual([
      { type: "text", value: "https://user:pass@example.com" },
    ]);
  });

  it("rejects hosts without a dot", () => {
    expect(splitLinks("http://localhost")).toEqual([{ type: "text", value: "http://localhost" }]);
  });

  it("rejects URLs over 2048 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(2029);
    expect(longUrl).toHaveLength(2049);
    expect(splitLinks(longUrl)).toEqual([{ type: "text", value: longUrl }]);
  });

  it("accepts a URL of exactly 2048 characters", () => {
    const url = "https://example.com/" + "a".repeat(2028);
    expect(url).toHaveLength(2048);
    const parts = splitLinks(url);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "link", value: url, href: url });
  });

  it("shortens long labels with an ellipsis", () => {
    const url = "https://example.com/" + "a".repeat(50);
    expect(splitLinks(url)).toEqual([
      {
        type: "link",
        value: url,
        href: url,
        label: "example.com/" + "a".repeat(29) + "…",
      },
    ]);
  });

  it("returns plain text unchanged when there are no links", () => {
    expect(splitLinks("just some plain text")).toEqual([
      { type: "text", value: "just some plain text" },
    ]);
  });

  it("leaves mailto: links as plain text", () => {
    expect(splitLinks("mail me at mailto:hi@example.com")).toEqual([
      { type: "text", value: "mail me at mailto:hi@example.com" },
    ]);
  });
});
