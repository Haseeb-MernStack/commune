import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePostShortcutKey,
  likeFocusedPost,
  movePostFocus,
  shouldIgnoreShortcutKey,
} from "./post-shortcuts";

function makePost(id: string, liked: boolean) {
  const article = document.createElement("article");
  article.setAttribute("data-post-id", id);
  article.tabIndex = -1;
  const button = document.createElement("button");
  button.setAttribute("aria-label", liked ? "Unlike" : "Like");
  article.appendChild(button);
  document.body.appendChild(article);
  return { article, button };
}

function fakeEvent(
  key: string,
  target: EventTarget | null,
  metaKey = false,
): KeyboardEvent {
  return {
    key,
    target,
    metaKey,
    ctrlKey: false,
    altKey: false,
  } as unknown as KeyboardEvent;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  (document.activeElement as HTMLElement | null)?.blur?.();
});

describe("shouldIgnoreShortcutKey", () => {
  it("ignores keys while typing in an input", () => {
    const input = document.createElement("input");
    expect(shouldIgnoreShortcutKey(fakeEvent("j", input))).toBe(true);
  });

  it("ignores keys while typing in a textarea", () => {
    const textarea = document.createElement("textarea");
    expect(shouldIgnoreShortcutKey(fakeEvent("j", textarea))).toBe(true);
  });

  it("ignores keys pressed with a modifier", () => {
    expect(shouldIgnoreShortcutKey(fakeEvent("j", document.body, true))).toBe(
      true,
    );
  });

  it("does not ignore a plain key on the body", () => {
    expect(shouldIgnoreShortcutKey(fakeEvent("j", document.body))).toBe(false);
  });
});

describe("movePostFocus", () => {
  it("focuses the first post, then the next one", () => {
    const first = makePost("a", false);
    const second = makePost("b", false);
    movePostFocus(1);
    expect(document.activeElement).toBe(first.article);
    movePostFocus(1);
    expect(document.activeElement).toBe(second.article);
  });

  it("stays on the last post", () => {
    makePost("a", false);
    const second = makePost("b", false);
    second.article.focus();
    movePostFocus(1);
    expect(document.activeElement).toBe(second.article);
  });

  it("moves to the previous post", () => {
    const first = makePost("a", false);
    const second = makePost("b", false);
    second.article.focus();
    movePostFocus(-1);
    expect(document.activeElement).toBe(first.article);
  });
});

describe("likeFocusedPost", () => {
  it("clicks the Like button of the focused post", () => {
    const { article, button } = makePost("a", false);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    article.focus();
    likeFocusedPost();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the focused post is already liked", () => {
    const { article, button } = makePost("a", true);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    article.focus();
    likeFocusedPost();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("handlePostShortcutKey", () => {
  it("ignores j inside a textarea", () => {
    const first = makePost("a", false);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    handlePostShortcutKey(fakeEvent("j", textarea));
    expect(document.activeElement).not.toBe(first.article);
  });

  it("moves focus with j and likes with l", () => {
    const { article, button } = makePost("a", false);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    handlePostShortcutKey(fakeEvent("j", document.body));
    expect(document.activeElement).toBe(article);
    handlePostShortcutKey(fakeEvent("l", article));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
