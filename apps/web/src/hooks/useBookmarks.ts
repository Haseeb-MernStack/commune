import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Page, PostDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { patchPost, type FeedData } from "./usePosts";

/** The signed-in person's saved posts. Keyed under "feed" so likes and edits update it too. */
export function useSaved() {
  return useInfiniteQuery({
    queryKey: ["feed", "saved"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(withQuery("/posts/saved", { cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * Saves or un-saves a post at once, then confirms with the server. If the request fails the post
 * goes back to how it was, so the bookmark never shows something that did not happen.
 */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<PostDTO>(`/posts/${id}/bookmark`, { method: "POST" }),
    onMutate: async (id) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ["feed"] }),
        qc.cancelQueries({ queryKey: ["post", id] }),
      ]);
      const feeds = qc.getQueriesData<FeedData>({ queryKey: ["feed"] });
      const single = qc.getQueryData<PostDTO>(["post", id]);
      patchPost(qc, id, (post) => ({ ...post, bookmarkedByMe: !post.bookmarkedByMe }));
      return { feeds, single };
    },
    onError: (_error, id, context) => {
      for (const [key, data] of context?.feeds ?? []) qc.setQueryData(key, data);
      if (context?.single) qc.setQueryData(["post", id], context.single);
    },
    onSuccess: (fresh) => {
      patchPost(qc, fresh.id, (post) => ({ ...post, bookmarkedByMe: fresh.bookmarkedByMe }));
      // The Saved page loads fresh the next time it is opened.
      void qc.invalidateQueries({ queryKey: ["feed", "saved"], refetchType: "none" });
    },
  });
}
