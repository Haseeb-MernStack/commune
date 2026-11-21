import { describe, expect, it } from "vitest";
import { splitLinks } from "@commune/shared";

const links = (text: string) => splitLinks(text).filter((p) => p.type === "link");

describe("splitLinks", () => {
  it("keeps text without links as one text part", () => {
    expect(splitLinks("hello world")).toEqual([{ type: "text", value: "hello world" }]);
    expect(splitLinks("")).toEqual([]);
  });

  it("finds a link and keeps the text around it", () => {
    const parts = splitLinks("read https://example.com/post now");
    expect(parts).toEqual([
      { type: "text", value: "read " },
      {
        type: "link",
        value: "https://example.com/post",
        href: "https://example.com/post",
        label: "example.com/post",
      },
      { type: "text", value: " now" },
    ]);
  });

  it("does not include the punctuation that ends a sentence", () => {
    expect(links("Visit https://example.com.")[0]).toMatchObject({ value: "https://example.com" });
    expect(links("Is it https://example.com/a?b=1!")[0]).toMatchObject({
      value: "https://example.com/a?b=1",
    });
  });

  it("handles brackets around or inside a link", () => {
    expect(links("(see https://example.com/x)")[0]).toMatchObject({
      value: "https://example.com/x",
    });
    expect(links("https://en.wikipedia.org/wiki/Rust_(language)")[0]).toMatchObject({
      value: "https://en.wikipedia.org/wiki/Rust_(language)",
    });
  });

  it("adds https to www links and finds several links", () => {
    const found = links("www.example.com and http://a.org/x");
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ href: "https://www.example.com/", label: "example.com" });
    expect(found[1]).toMatchObject({ href: "http://a.org/x" });
  });

  it("shortens long labels but keeps the full address", () => {
    const long = `https://example.com/${"a".repeat(100)}`;
    const [link] = links(long);
    expect(link).toMatchObject({ value: long });
    expect(link && link.type === "link" && link.label.length).toBeLessThanOrEqual(42);
    expect(link && link.type === "link" && link.label.endsWith("…")).toBe(true);
  });

  it("never turns unsafe or misleading addresses into links", () => {
    expect(links("javascript:alert(1)")).toEqual([]);
    expect(links("data:text/html,hi")).toEqual([]);
    expect(links("ftp://example.com/file")).toEqual([]);
    expect(links("https://paypal.com@evil.example/login")).toEqual([]);
    expect(links("https://localhost:3000")).toEqual([]);
    expect(links("https://" + "a".repeat(2100) + ".com")).toEqual([]);
  });

  it("leaves markup as plain text", () => {
    const parts = splitLinks('<a href="https://x.com">hi</a>');
    expect(parts.every((p) => p.type === "text" || !p.value.includes("<"))).toBe(true);
  });
});
