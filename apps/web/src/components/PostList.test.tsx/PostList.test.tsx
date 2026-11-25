import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PostList from "./PostList";
import type { useFeed } from "../hooks/usePosts";

vi.mock("./PostCard", () => ({
  default: () => <article>post</article>,
}));

type FeedQuery = ReturnType<typeof useFeed>;

function makeQuery(overrides: Record<string, unknown> = {}): FeedQuery {
  return {
    data: { pages: [{ items: [{ id: "p1" }] }], pageParams: [] },
    isSuccess: true,
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as FeedQuery;
}

describe("PostList caught-up line", () => {
  it("shows 'You're all caught up' at the true end of a list", () => {
    render(<PostList query={makeQuery()} emptyMessage="Nothing here yet" />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("does not show it while there are more pages", () => {
    render(<PostList query={makeQuery({ hasNextPage: true })} emptyMessage="Nothing here yet" />);
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.getByText("Load more")).toBeInTheDocument();
  });

  it("does not show it for an empty list", () => {
    render(
      <PostList
        query={makeQuery({ data: { pages: [{ items: [] }], pageParams: [] } })}
        emptyMessage="Nothing here yet"
      />,
    );
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("does not show it while loading", () => {
    render(
      <PostList
        query={makeQuery({ isSuccess: false, isLoading: true, data: undefined })}
        emptyMessage="Nothing here yet"
      />,
    );
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });
});
