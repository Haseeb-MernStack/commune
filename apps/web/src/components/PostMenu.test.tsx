import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PostMenu, { type MenuItem } from "./PostMenu";

const LABEL = "Post options";

const selectOne = vi.fn();
const selectTwo = vi.fn();
const selectThree = vi.fn();

const firstItem: MenuItem = {
  key: "one",
  label: "First action",
  icon: "bookmark",
  onSelect: selectOne,
};
const secondItem: MenuItem = {
  key: "two",
  label: "Second action",
  icon: "share",
  onSelect: selectTwo,
};
const thirdItem: MenuItem = {
  key: "three",
  label: "Third action",
  icon: "flag",
  onSelect: selectThree,
};
const defaultItems: MenuItem[] = [firstItem, secondItem, thirdItem];

const mediaQueryStub = {
  get matches() {
    return false;
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

const originalMatchMedia = window.matchMedia;

function renderMenu(items: MenuItem[] = defaultItems) {
  const user = userEvent.setup();
  render(<PostMenu items={items} label={LABEL} />);
  const button = screen.getByRole("button", { name: LABEL });
  return { user, button };
}

describe("PostMenu", () => {
  beforeEach(() => {
    window.matchMedia = () => mediaQueryStub as unknown as MediaQueryList;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  it("starts closed with aria-expanded false", () => {
    const { button } = renderMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and focuses the first item", async () => {
    const { user, button } = renderMenu();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: LABEL })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "First action" })).toHaveFocus();
  });

  it("selecting an item calls onSelect and closes the menu", async () => {
    const { user, button } = renderMenu();
    await user.click(button);
    await user.click(screen.getByRole("menuitem", { name: "Second action" }));
    expect(selectTwo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape closes the menu and returns focus to the button", async () => {
    const { user, button } = renderMenu();
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("ArrowDown moves focus to the next item", async () => {
    const { user, button } = renderMenu();
    await user.click(button);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Second action" })).toHaveFocus();
  });

  it("ArrowUp moves focus to the previous item and wraps to the last", async () => {
    const { user, button } = renderMenu();
    await user.click(button);
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Third action" })).toHaveFocus();
  });

  it("ArrowDown on the closed button opens the menu", async () => {
    const { user, button } = renderMenu();
    button.focus();
    await user.keyboard("{ArrowDown}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: LABEL })).toBeInTheDocument();
  });

  it("a click outside closes the menu", async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole("button", { name: LABEL }));
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("a disabled item cannot be selected", async () => {
    const { user, button } = renderMenu([firstItem, secondItem, { ...thirdItem, disabled: true }]);
    await user.click(button);
    const third = screen.getByRole("menuitem", { name: "Third action" });
    expect(third).toBeDisabled();
    await user.click(third);
    expect(selectThree).not.toHaveBeenCalled();
    expect(screen.getByRole("menu", { name: LABEL })).toBeInTheDocument();
  });
});
