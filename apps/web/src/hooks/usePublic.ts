import { useInfiniteQuery } from "@tanstack/react-query";
import type { Page, PostDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";

/** Latest free posts, readable without logging in. */
export function usePublicPosts() {
  return useInfiniteQuery({
    queryKey: ["public", "posts"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(withQuery("/public/posts", { cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
