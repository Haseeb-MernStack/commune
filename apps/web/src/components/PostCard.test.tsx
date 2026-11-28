import type { PostDTO } from "@commune/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostCard from "./PostCard";
import Toasts from "./Toasts";
import { dismissToast } from "../lib/toast";

const idleMutation = () => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
});

vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("../hooks/usePosts", () => ({
  useToggleLike: () => idleMutation(),
  useDeletePost: () => idleMutation(),
  useUndoableDeletePost: () => idleMutation(),
  useUpdatePost: () => idleMutation(),
}));

vi.mock("../lib/pendingDeletes", () => ({
  useHiddenPosts: () => new Set<string>(),
}));

vi.mock("../hooks/useBookmarks", () => ({
  useToggleBookmark: () => idleMutation(),
}));

vi.mock("../hooks/usePayments", () => ({
  formatPrice: (cents: number) => `$${(cents / 100).toFixed(2)}`,
  useCheckout: () => idleMutation(),
}));

vi.mock("../hooks/useBlocks", () => ({
  useSetBlock: () => idleMutation(),
}));

vi.mock("../lib/haptics", () => ({
  tap: vi.fn(),
}));

const originalMatchMedia = window.matchMedia;

function makePost(overrides: Partial<PostDTO> = {}): PostDTO {
  return {
    id: "post-1",
    content: "Hello Commune community!",
    imageUrl: null,
    author: {
      id: "author-1",
      username: "alice",
      avatarUrl: null,
      plus: false,
    },
    likeCount: 2,
    commentCount: 1,
    likedByMe: false,
    bookmarkedByMe: false,
    community: null,
    priceCents: null,
    locked: false,
    premiumContent: null,
    createdAt: "2025-01-15T00:00:00.000Z",
    editedAt: null,
    ...overrides,
  };
}

function renderPost(post: PostDTO = makePost()) {
  return render(
    <MemoryRouter>
      <PostCard post={post} />
      <Toasts />
    </MemoryRouter>,
  );
}

describe("PostCard sharing", () => {
  beforeEach(() => {
    window.matchMedia = () =>
      ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }) as unknown as MediaQueryList;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      dismissToast(id);
    }
  });

  it("shares free post text and URL via navigator.share", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });

    renderPost();
    await user.click(screen.getByRole("button", { name: "Share post" }));

    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      text: "Hello Commune community!",
      url: `${window.location.origin}/posts/post-1`,
    });
  });

  it("does not include text when sharing a paid post", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });

    renderPost(makePost({ priceCents: 500, locked: true }));
    await user.click(screen.getByRole("button", { name: "Share post" }));

    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      url: `${window.location.origin}/posts/post-1`,
    });
  });

  it("falls back to copying the post link with toast feedback when navigator.share is absent", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    renderPost();
    await user.click(screen.getByRole("button", { name: "Share post" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/post-1`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
    expect(screen.getByRole("status")).toHaveTextContent("Share this post with anyone.");
  });

  it("copies the post link from the post menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    renderPost();
    await user.click(screen.getByRole("button", { name: "More options for the post by @alice" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/post-1`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });
});
