import { describe, expect, it } from "vitest";

import { render, screen } from "../test/setup";
import { highlightText } from "./highlight";

function renderHighlight(text: string, query: string) {
  return render(<div>{highlightText(text, query)}</div>);
}

describe("highlightText", () => {
  it("wraps a matching word in mark", () => {
    renderHighlight("Hello world", "world");
    const mark = document.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("world");
  });

  it("matches case-insensitively and keeps the original case", () => {
    renderHighlight("Hello World", "WORLD");
    expect(screen.getByText("World").tagName).toBe("MARK");
  });

  it("does not crash on special characters in the query", () => {
    renderHighlight("Version 1.2 (beta) *", "1.2 (beta) *");
    expect(document.querySelector("mark")).not.toBeNull();
    expect(screen.getByText("1.2").tagName).toBe("MARK");
  });

  it("returns the text unchanged for an empty query", () => {
    renderHighlight("Hello world", "   ");
    expect(document.querySelector("mark")).toBeNull();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("highlights each word of a multi-word query", () => {
    renderHighlight("cats and dogs", "cats dogs");
    expect(document.querySelectorAll("mark")).toHaveLength(2);
  });
});
