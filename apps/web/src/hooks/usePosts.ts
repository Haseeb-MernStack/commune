import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** `pollWhileLocked` re-checks every 2s: after paying, the unlock arrives via a webhook. */
export function usePost(id: string, pollWhileLocked = false) {
  return useQuery({
    queryKey: ["post", id],
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
    mutationFn: (input: CreatePostInput) =>
      api<PostDTO>("/posts", { method: "POST", body: input }),
    // ["feed"] also covers community feeds, which are keyed ["feed", "community", slug].
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<PostDTO>(`/posts/${id}/like`, { method: "POST" }),
    onSuccess: (post) => {
      qc.setQueryData(["post", post.id], post);
      void qc.invalidateQueries({ queryKey: ["feed"] });
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
