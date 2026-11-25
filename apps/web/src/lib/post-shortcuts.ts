// j / k / l shortcuts for feeds. Posts are focus targets
// (tabIndex={-1} and data-post-id on the PostCard article); j and k move
// focus between them and l likes the focused post. The shortcuts never
// fire while typing in a field or with a modifier key held down.

export function shouldIgnoreShortcutKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function getPostElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-post-id]"));
}

export function focusPostAt(index: number): void {
  const posts = getPostElements();
  if (posts.length === 0) return;
  const clamped = Math.max(0, Math.min(index, posts.length - 1));
  const element = posts[clamped];
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  try {
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  } catch {
    // Focus is the important part; scrolling is best-effort.
  }
}

export function movePostFocus(direction: 1 | -1): void {
  const posts = getPostElements();
  if (posts.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const current = posts.findIndex(
    (element) => element === active || element.contains(active),
  );
  const next = current === -1 ? 0 : current + direction;
  if (next < 0 || next >= posts.length) return;
  focusPostAt(next);
}

export function likeFocusedPost(): void {
  const active = document.activeElement as HTMLElement | null;
  const post = active?.closest("[data-post-id]") as HTMLElement | null;
  if (!post) return;
  const likeButton = post.querySelector(
    'button[aria-label^="Like"]',
  ) as HTMLButtonElement | null;
  likeButton?.click();
}

export function handlePostShortcutKey(event: KeyboardEvent): void {
  if (shouldIgnoreShortcutKey(event)) return;
  if (event.key === "j") movePostFocus(1);
  else if (event.key === "k") movePostFocus(-1);
  else if (event.key === "l") likeFocusedPost();
}
