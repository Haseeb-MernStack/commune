import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PostDTO } from "@commune/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToggleBookmark } from "./useBookmarks";
import type { FeedData } from "./usePosts";

const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ api: h.api, withQuery: (p: string) => p }));

const post: PostDTO = {
  id: "p1",
  author: { id: "a1", username: "ada", displayName: "Ada", avatarUrl: null },
  content: "Hello",
  media: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  likedByMe: false,
  likeCount: 0,
  bookmarkedByMe: false,
  commentCount: 0,
  locked: false,
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  qc.setQueryData<FeedData>(["feed", "all"], {
    pages: [{ items: [post], nextCursor: null }],
    pageParams: [undefined],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useToggleBookmark(), { wrapper });
  const bookmarked = () =>
    qc.getQueryData<FeedData>(["feed", "all"])?.pages[0]?.items[0]?.bookmarkedByMe;
  return { qc, ...utils, bookmarked };
}

describe("useToggleBookmark", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the post as saved while the request is pending, then rolls back when it fails", async () => {
    const { result, bookmarked } = setup();
    const request = deferred<PostDTO>();
    h.api.mockImplementationOnce(() => request.promise);
    let done: Promise<PostDTO>;
    act(() => {
      done = result.current.mutateAsync("p1");
    });
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    expect(h.api).toHaveBeenCalledWith("/posts/p1/bookmark", { method: "POST" });
    await waitFor(() => expect(bookmarked()).toBe(true));
    await act(async () => {
      request.reject(new Error("Network down"));
      await expect(done).rejects.toThrow("Network down");
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(bookmarked()).toBe(false);
  });

  it("keeps the post saved when the request succeeds", async () => {
    const { result, bookmarked } = setup();
    const saved: PostDTO = { ...post, bookmarkedByMe: true };
    h.api.mockResolvedValueOnce(saved);
    await act(async () => {
      await result.current.mutateAsync("p1");
    });
    expect(h.api).toHaveBeenCalledWith("/posts/p1/bookmark", { method: "POST" });
    expect(bookmarked()).toBe(true);
    expect(result.current.isSuccess).toBe(true);
  });
});
