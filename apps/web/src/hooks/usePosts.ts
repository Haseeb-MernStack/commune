import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type { CommentDTO, CreatePostInput, Page, PostDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";

export type FeedType = "all" | "following";

export function useFeed(feed: FeedType = "all") {
  return useInfiniteQuery({
    queryKey: ["feed", feed],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(withQuery("/posts", { feed, cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

function findPostInFeeds(qc: QueryClient, id: string): PostDTO | undefined {
  for (const [, data] of qc.getQueriesData<InfiniteData<Page<PostDTO>>>({ queryKey: ["feed"] })) {
    const hit = data?.pages.flatMap((p) => p.items).find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** `pollWhileLocked` re-checks every 2s: after paying, the unlock arrives via a webhook. */
export function usePost(id: string, pollWhileLocked = false) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["post", id],
    // Opening a post you just saw in a feed shows it at once; the fresh copy loads behind it.
    placeholderData: () => findPostInFeeds(qc, id),
    queryFn: () => api<PostDTO>(`/posts/${id}`),
    refetchInterval: (query) => (pollWhileLocked && query.state.data?.locked ? 2000 : false),
  });
}

export function useComments(id: string) {
  return useQuery({
    queryKey: ["comments", id],
    queryFn: () => api<CommentDTO[]>(`/posts/${id}/comments`),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api<PostDTO>("/posts", { method: "POST", body: input }),
    // ["feed"] also covers community feeds, which are keyed ["feed", "community", slug].
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

type FeedData = InfiniteData<Page<PostDTO>>;

/** Applies `change` to one post everywhere it is cached: every feed and the single-post view. */
function patchPost(qc: QueryClient, id: string, change: (post: PostDTO) => PostDTO) {
  qc.setQueriesData<FeedData>({ queryKey: ["feed"] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === id ? change(post) : post)),
          })),
        }
      : data,
  );
  qc.setQueryData<PostDTO>(["post", id], (post) => (post ? change(post) : post));
}

/**
 * Likes or unlikes at once, then confirms with the server. If the request fails, the post goes
 * back to how it was, so the heart never shows something that did not happen.
 */
export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<PostDTO>(`/posts/${id}/like`, { method: "POST" }),
    onMutate: async (id) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ["feed"] }),
        qc.cancelQueries({ queryKey: ["post", id] }),
      ]);
      const feeds = qc.getQueriesData<FeedData>({ queryKey: ["feed"] });
      const single = qc.getQueryData<PostDTO>(["post", id]);
      patchPost(qc, id, (post) => ({
        ...post,
        likedByMe: !post.likedByMe,
        likeCount: Math.max(0, post.likeCount + (post.likedByMe ? -1 : 1)),
      }));
      return { feeds, single };
    },
    onError: (_error, id, context) => {
      for (const [key, data] of context?.feeds ?? []) qc.setQueryData(key, data);
      if (context?.single) qc.setQueryData(["post", id], context.single);
    },
    onSuccess: (fresh) => {
      // The server's numbers win, without reloading every page of every feed.
      patchPost(qc, fresh.id, (post) => ({
        ...post,
        likedByMe: fresh.likedByMe,
        likeCount: fresh.likeCount,
      }));
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<CommentDTO>(`/posts/${postId}/comments`, { method: "POST", body: { content } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
      void qc.invalidateQueries({ queryKey: ["post", postId] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
