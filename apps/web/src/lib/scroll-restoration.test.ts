import { useEffect } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSavedScrollPositions,
  readScrollPosition,
  saveScrollPosition,
  useFeedScrollRestoration,
} from "./scroll-restoration";

// jsdom has no scrolling; record the calls instead.
const scrollTo = vi.fn();
window.scrollTo = scrollTo;

beforeEach(() => {
  scrollTo.mockClear();
  clearSavedScrollPositions();
});

function Probe({ ready }: { ready: boolean }) {
  useFeedScrollRestoration(ready);
  return <p>probe</p>;
}

describe("scroll position helpers", () => {
  it("returns undefined for a key that was never saved", () => {
    expect(readScrollPosition("no-such-key")).toBeUndefined();
  });

  it("returns the saved position for its key", () => {
    saveScrollPosition("home", 420);
    expect(readScrollPosition("home")).toBe(420);
  });

  it("keeps positions separate per key and overwrites", () => {
    saveScrollPosition("a", 100);
    saveScrollPosition("b", 200);
    saveScrollPosition("a", 150);
    expect(readScrollPosition("a")).toBe(150);
    expect(readScrollPosition("b")).toBe(200);
  });
});

describe("useFeedScrollRestoration", () => {
  it("does nothing on back navigation when nothing was saved", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready />
      </MemoryRouter>,
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("restores the saved position on back navigation once the feed is ready", () => {
    saveScrollPosition("default", 420);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready />
      </MemoryRouter>,
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 420);
  });

  it("waits for the feed before restoring", () => {
    saveScrollPosition("default", 420);
    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready={false} />
      </MemoryRouter>,
    );
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready />
      </MemoryRouter>,
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 420);
  });

  it("starts a new page at the top on push navigation", () => {
    function Go() {
      const navigate = useNavigate();
      useEffect(() => {
        navigate("/explore");
      }, [navigate]);
      return null;
    }
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready />
        <Go />
      </MemoryRouter>,
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("saves the position when leaving the feed", () => {
    Object.defineProperty(window, "scrollY", { value: 777, configurable: true });
    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe ready />
      </MemoryRouter>,
    );
    unmount();
    expect(readScrollPosition("default")).toBe(777);
  });
});
