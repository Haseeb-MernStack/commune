import { describe, expect, it, vi } from "vitest";
import { SHORTCUTS, handleShortcutKey, isTypingTarget } from "./shortcuts";

function keyEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
}

describe("SHORTCUTS", () => {
  it("lists the three global shortcuts", () => {
    expect(SHORTCUTS.map((s) => s.key)).toEqual(["?", "n", "/"]);
    expect(SHORTCUTS.every((s) => s.description.length > 0)).toBe(true);
  });
});

describe("isTypingTarget", () => {
  it("returns false for null and for plain elements", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });

  it("returns true for inputs, textareas, selects and editable elements", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(isTypingTarget(editable)).toBe(true);
  });
});

describe("handleShortcutKey", () => {
  it("runs the action for a listed key and returns true", () => {
    const open = vi.fn();
    const write = vi.fn();
    const search = vi.fn();
    const event = keyEvent("?");
    expect(handleShortcutKey(event, { "?": open, n: write, "/": search })).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("runs the n and / actions for their keys", () => {
    const write = vi.fn();
    const search = vi.fn();
    expect(handleShortcutKey(keyEvent("n"), { n: write })).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(handleShortcutKey(keyEvent("/"), { "/": search })).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("returns true even when no action is supplied for the key", () => {
    expect(handleShortcutKey(keyEvent("n"), {})).toBe(true);
  });

  it("ignores unlisted keys", () => {
    const write = vi.fn();
    expect(handleShortcutKey(keyEvent("x"), { n: write })).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("ignores keys pressed with a modifier", () => {
    const write = vi.fn();
    expect(handleShortcutKey(keyEvent("n", { ctrlKey: true }), { n: write })).toBe(false);
    expect(handleShortcutKey(keyEvent("n", { metaKey: true }), { n: write })).toBe(false);
    expect(handleShortcutKey(keyEvent("n", { altKey: true }), { n: write })).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not fire while typing in a field", () => {
    const write = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    let result: boolean | undefined;
    input.addEventListener("keydown", (e) => {
      result = handleShortcutKey(e, { n: write });
    });
    input.dispatchEvent(keyEvent("n"));
    expect(result).toBe(false);
    expect(write).not.toHaveBeenCalled();
    input.remove();
  });

  it("does not fire while a modal dialog is open", () => {
    const open = vi.fn();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.appendChild(dialog);
    expect(handleShortcutKey(keyEvent("?"), { "?": open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
    dialog.remove();
  });
});
