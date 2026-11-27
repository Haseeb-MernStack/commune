import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PostList from "./PostList";
import type { useFeed } from "../hooks/usePosts";

vi.mock("./PostCard", () => ({
  default: ({ post }: { post: { id: string; content: string } }) => (
    <article data-testid="post-card">{post.content}</article>
  ),
}));

vi.mock("../hooks/useInfiniteScroll", () => ({
  useLoadMoreOnVisible: () => () => {},
}));

type FeedQuery = ReturnType<typeof useFeed>;

function makeQuery(overrides: Partial<FeedQuery> = {}): FeedQuery {
  return {
    data: {
      pages: [{ items: [{ id: "1", content: "Hello world" }], nextCursor: null }],
      pageParams: [undefined],
    },
    isLoading: false,
    isSuccess: true,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    error: null,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as FeedQuery;
}

describe("PostList", () => {
  it("shows the caught-up indicator only at the end of a non-empty feed", () => {
    render(<PostList query={makeQuery()} emptyMessage="No posts yet." />);
    const text = screen.getByText("You're all caught up");
    expect(text.closest('[role="status"]')).toBeInTheDocument();
  });

  it("hides the caught-up indicator when more pages exist", () => {
    render(<PostList query={makeQuery({ hasNextPage: true })} emptyMessage="No posts yet." />);
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });

  it("hides the caught-up indicator for an empty feed", () => {
    render(
      <PostList
        query={makeQuery({
          data: { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] },
        })}
        emptyMessage="No posts yet."
      />,
    );
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });

  it("hides the caught-up indicator while loading", () => {
    render(
      <PostList
        query={makeQuery({ data: undefined, isLoading: true, isSuccess: false })}
        emptyMessage="No posts yet."
      />,
    );
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });
});
