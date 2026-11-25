import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorDTO, CommentDTO, PostDTO } from "@commune/shared";
import { isPendingComment, useAddComment } from "./usePosts";

const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ api: h.api, withQuery: (p: string) => p }));

const me: AuthorDTO = { id: "u1", username: "me", avatarUrl: null, plus: false };
const old: CommentDTO = {
  id: "c1",
  postId: "p1",
  content: "first",
  author: { ...me, id: "u2", username: "other" },
  createdAt: "2026-01-01T00:00:00.000Z",
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
  // Cached data never goes stale here, so the background refetches stay out of the way.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  qc.setQueryData<CommentDTO[]>(["comments", "p1"], [old]);
  qc.setQueryData(["post", "p1"], { id: "p1", commentCount: 1 } as PostDTO);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useAddComment("p1", me), { wrapper });
  const comments = () => qc.getQueryData<CommentDTO[]>(["comments", "p1"]) ?? [];
  const count = () => qc.getQueryData<PostDTO>(["post", "p1"])?.commentCount;
  return { result, comments, count };
}

describe("useAddComment", () => {
  beforeEach(() => {
    h.api.mockReset();
  });

  it("shows the comment at once, then swaps in the saved one without a duplicate", async () => {
    const request = deferred<CommentDTO>();
    h.api.mockReturnValue(request.promise);
    const { result, comments, count } = setup();

    act(() => result.current.mutate("hello"));
    await waitFor(() => expect(comments()).toHaveLength(2));
    const pending = comments()[1]!;
    expect(isPendingComment(pending)).toBe(true);
    expect(pending).toMatchObject({ content: "hello", author: me });
    expect(count()).toBe(2);

    const saved: CommentDTO = { ...pending, id: "c2", createdAt: "2026-01-02T00:00:00.000Z" };
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    // Refetches after success answer with the server's list.
    h.api.mockResolvedValue([old, saved]);
    await act(async () => request.resolve(saved));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(comments().map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(count()).toBe(2);
  });

  it("removes the comment and restores the count when the request fails", async () => {
    let fail!: (e: Error) => void;
    h.api.mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)));
    const { result, comments, count } = setup();

    act(() => result.current.mutate("hello"));
    await waitFor(() => expect(comments()).toHaveLength(2));
    // The comment shows before the request starts; fail it only once it is in flight.
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    await act(async () => fail(new Error("Network down")));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Network down");
    expect(comments()).toEqual([old]);
    expect(count()).toBe(1);
  });
});
