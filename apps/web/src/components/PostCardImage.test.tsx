import type { PostDTO } from "@commune/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PostCard from "./PostCard";

const idle = () => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
});

vi.mock("../store/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../hooks/usePosts", () => ({
  useToggleLike: () => idle(),
  useDeletePost: () => idle(),
  useUndoableDeletePost: () => idle(),
  useUpdatePost: () => idle(),
}));
vi.mock("../lib/pendingDeletes", () => ({ useHiddenPosts: () => new Set<string>() }));
vi.mock("../hooks/useBookmarks", () => ({ useToggleBookmark: () => idle() }));
vi.mock("../hooks/usePayments", () => ({ formatPrice: () => "$1", useCheckout: () => idle() }));
vi.mock("../hooks/useBlocks", () => ({ useSetBlock: () => idle() }));
vi.mock("../lib/haptics", () => ({ tap: vi.fn() }));

const post: PostDTO = {
  id: "p1",
  content: "Look at this",
  imageUrl: "/uploads/0123456789abcdef0123456789abcdef.jpg",
  author: { id: "a1", username: "alice", avatarUrl: null, plus: false },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  bookmarkedByMe: false,
  community: null,
  priceCents: null,
  locked: false,
  premiumContent: null,
  createdAt: "2025-01-15T00:00:00.000Z",
  editedAt: null,
};

describe("PostCard picture", () => {
  it("opens the picture inside the app instead of a new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <MemoryRouter>
        <PostCard post={post} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("Close image")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /full screen/ }));

    expect(await screen.findByRole("button", { name: "Close image" })).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Close image" }));
    expect(screen.queryByRole("button", { name: "Close image" })).not.toBeInTheDocument();
  });

  it("opens straight away when Ctrl is held", async () => {
    render(
      <MemoryRouter>
        <PostCard post={post} />
      </MemoryRouter>,
    );
    await userEvent.keyboard("{Control>}");
    await userEvent.click(screen.getByRole("button", { name: /full screen/ }));
    await userEvent.keyboard("{/Control}");
    expect(screen.getByRole("button", { name: "Close image" })).toBeInTheDocument();
  });
});
