import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type { AuthorDTO, CommentDTO, CreatePostInput, Page, PostDTO } from "@commune/shared";
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

export type FeedData = InfiniteData<Page<PostDTO>>;

/** Applies `change` to one post everywhere it is cached: every feed and the single-post view. */
export function patchPost(qc: QueryClient, id: string, change: (post: PostDTO) => PostDTO) {
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

/** Saves new text for one of your own posts and updates every list that shows it. */
export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api<PostDTO>(`/posts/${id}`, { method: "PATCH", body: { content } }),
    onSuccess: (fresh) =>
      patchPost(qc, fresh.id, (post) => ({
        ...post,
        content: fresh.content,
        editedAt: fresh.editedAt,
      })),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

/** Prefix of the local id a comment has while it is being sent. */
export const PENDING_COMMENT_PREFIX = "pending-";

export const isPendingComment = (c: CommentDTO) => c.id.startsWith(PENDING_COMMENT_PREFIX);

const changeCommentCount = (qc: QueryClient, postId: string, by: number) =>
  patchPost(qc, postId, (post) => ({
    ...post,
    commentCount: Math.max(0, post.commentCount + by),
  }));

/**
 * Shows the comment at once, with a pending id, then swaps in the server's copy. If the request
 * fails the comment and the count go back to how they were; the page puts the text back.
 */
export function useAddComment(postId: string, author: AuthorDTO | null) {
  const qc = useQueryClient();
  const key = ["comments", postId];
  return useMutation({
    mutationFn: (content: string) =>
      api<CommentDTO>(`/posts/${postId}/comments`, { method: "POST", body: { content } }),
    onMutate: async (content) => {
      if (!author) return undefined;
      await qc.cancelQueries({ queryKey: key });
      const pending: CommentDTO = {
        id: `${PENDING_COMMENT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
        postId,
        content,
        author,
        createdAt: new Date().toISOString(),
      };
      // Comments are listed oldest first, so a new one goes at the end.
      qc.setQueryData<CommentDTO[]>(key, (list) => [...(list ?? []), pending]);
      changeCommentCount(qc, postId, 1);
      return { pendingId: pending.id };
    },
    onError: (_error, _content, context) => {
      if (!context) return;
      qc.setQueryData<CommentDTO[]>(key, (list) => list?.filter((c) => c.id !== context.pendingId));
      changeCommentCount(qc, postId, -1);
    },
    onSuccess: (saved, _content, context) => {
      // Replace the pending copy, and never list the saved comment twice.
      qc.setQueryData<CommentDTO[]>(key, (list) => {
        const rest = (list ?? []).filter((c) => c.id !== saved.id);
        return context
          ? rest.map((c) => (c.id === context.pendingId ? saved : c))
          : [...rest, saved];
      });
      if (!context) changeCommentCount(qc, postId, 1);
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["post", postId] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
