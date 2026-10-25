import { useInfiniteQuery } from "@tanstack/react-query";
import type { Page, PostDTO, UserSummaryDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";

// The server's "cursor" for search is simply the next page number, as a string.
export function useSearchPosts(q: string) {
  return useInfiniteQuery({
    queryKey: ["search", "posts", q],
    enabled: q.length >= 2,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(withQuery("/search/posts", { q, page: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSearchUsers(q: string) {
  return useInfiniteQuery({
    queryKey: ["search", "users", q],
    enabled: q.length >= 2,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<UserSummaryDTO>>(withQuery("/search/users", { q, page: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
