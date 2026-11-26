import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScrollRestorer from "./ScrollRestorer";

let navigate: ReturnType<typeof useNavigate>;
function NavigateHandle() {
  navigate = useNavigate();
  return null;
}

/** jsdom does not scroll: this window scrolls wherever it is told, as a tall page would. */
let y = 0;
const scrollTo = vi.fn((_x: number, top: number) => {
  y = top;
});

function scrollBy(top: number) {
  y = top;
  window.dispatchEvent(new Event("scroll"));
}

function renderApp(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ScrollRestorer />
      <NavigateHandle />
    </MemoryRouter>,
  );
}

describe("ScrollRestorer", () => {
  beforeEach(() => {
    y = 0;
    scrollTo.mockClear();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns to the same place in the feed on Back", () => {
    renderApp("/");
    act(() => scrollBy(1200));

    act(() => navigate("/posts/1"));
    expect(y).toBe(0);
    act(() => scrollBy(300));

    act(() => navigate(-1));
    expect(y).toBe(1200);
  });

  it("starts a new page at the top, even one visited before", () => {
    renderApp("/");
    act(() => navigate("/explore"));
    act(() => scrollBy(800));

    act(() => navigate("/u/sam"));
    expect(y).toBe(0);

    // Opening Explore again from a link is a new visit, not a Back.
    act(() => navigate("/explore"));
    expect(y).toBe(0);
  });

  it("keeps each history entry's own position across several Backs", () => {
    renderApp("/");
    act(() => scrollBy(500));
    act(() => navigate("/u/sam"));
    act(() => scrollBy(900));
    act(() => navigate("/posts/1"));

    act(() => navigate(-1));
    expect(y).toBe(900);
    act(() => navigate(-1));
    expect(y).toBe(500);
  });

  it("leaves a hash link to scroll to its own target", () => {
    renderApp("/");
    act(() => scrollBy(400));
    scrollTo.mockClear();

    act(() => navigate("/help#faq"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("takes over the browser's own restoration while mounted", () => {
    window.history.scrollRestoration = "auto";
    const { unmount } = renderApp("/");
    expect(window.history.scrollRestoration).toBe("manual");
    unmount();
    expect(window.history.scrollRestoration).toBe("auto");
  });
});
