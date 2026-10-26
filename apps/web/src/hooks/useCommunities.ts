import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommunityDTO, CreateCommunityInput, Page, PostDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";

export function useCommunities(filter: { q?: string; mine?: boolean }) {
  return useQuery({
    queryKey: ["communities", filter],
    queryFn: () =>
      api<CommunityDTO[]>(withQuery("/communities", { q: filter.q, mine: filter.mine ? "1" : undefined })),
  });
}

export function useCommunity(slug: string) {
  return useQuery({
    queryKey: ["community", slug],
    queryFn: () => api<CommunityDTO>(`/communities/${slug}`),
  });
}

export function useCommunityPosts(slug: string) {
  return useInfiniteQuery({
    queryKey: ["feed", "community", slug],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(withQuery(`/communities/${slug}/posts`, { cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommunityInput) =>
      api<CommunityDTO>("/communities", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useMembership(slug: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["community", slug] });
    void qc.invalidateQueries({ queryKey: ["communities"] });
  };
  const join = useMutation({
    mutationFn: () => api<void>(`/communities/${slug}/join`, { method: "POST" }),
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: () => api<void>(`/communities/${slug}/join`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { join, leave };
}
