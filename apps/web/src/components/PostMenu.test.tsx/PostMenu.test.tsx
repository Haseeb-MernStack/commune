import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostMenu from "./PostMenu";
import type { MenuItem } from "./PostMenu";

const items: MenuItem[] = [
  { key: "save", label: "Save", icon: "check", onSelect: vi.fn() },
  { key: "share", label: "Share", icon: "close", onSelect: vi.fn() },
];

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
  });
}

function openMenu() {
  render(<PostMenu label="Post options" items={items} />);
  fireEvent.click(screen.getByRole("button", { name: "Post options" }));
  const menu = document.querySelector(".post-menu") as HTMLElement;
  const grab = menu.querySelector(".menu-grab") as HTMLElement;
  return { menu, grab };
}

// A slow drag: 200ms between press and move, so the flick rule stays out.
function drag(grab: HTMLElement, fromY: number, toY: number, ms = 200) {
  fireEvent.pointerDown(grab, { clientY: fromY, button: 0 });
  vi.advanceTimersByTime(ms);
  fireEvent.pointerMove(window, { clientY: toY, button: 0 });
  fireEvent.pointerUp(window, { clientY: toY, button: 0 });
}

describe("PostMenu swipe to close", () => {
  beforeEach(() => {
    mockMatchMedia(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows the finger while dragging", () => {
    const { menu, grab } = openMenu();
    fireEvent.pointerDown(grab, { clientY: 100, button: 0 });
    vi.advanceTimersByTime(200);
    fireEvent.pointerMove(window, { clientY: 180, button: 0 });
    expect(menu.style.transform).toBe("translateY(80px)");
    fireEvent.pointerUp(window, { clientY: 180, button: 0 });
    expect(menu.style.transform).toBe("");
    expect(document.querySelector(".post-menu")).not.toBeNull();
  });

  it("closes after a drag past 80px", () => {
    const { grab } = openMenu();
    drag(grab, 100, 200);
    expect(document.querySelector(".post-menu")).toBeNull();
  });

  it("snaps back after a short, slow drag", () => {
    const { menu, grab } = openMenu();
    drag(grab, 100, 130);
    expect(document.querySelector(".post-menu")).not.toBeNull();
    expect(menu.style.transform).toBe("");
  });

  it("closes on a fast flick", () => {
    const { grab } = openMenu();
    drag(grab, 100, 160, 16);
    expect(document.querySelector(".post-menu")).toBeNull();
  });

  it("does not move on a wide screen", () => {
    mockMatchMedia(false);
    const { menu, grab } = openMenu();
    drag(grab, 100, 200);
    expect(document.querySelector(".post-menu")).not.toBeNull();
    expect(menu.style.transform).toBe("");
  });

  it("does not start a drag from a menu item", () => {
    const { menu } = openMenu();
    const item = screen.getByRole("menuitem", { name: "Save" });
    fireEvent.pointerDown(item, { clientY: 100, button: 0 });
    vi.advanceTimersByTime(200);
    fireEvent.pointerMove(window, { clientY: 200, button: 0 });
    fireEvent.pointerUp(window, { clientY: 200, button: 0 });
    expect(document.querySelector(".post-menu")).not.toBeNull();
    expect(menu.style.transform).toBe("");
  });
});
