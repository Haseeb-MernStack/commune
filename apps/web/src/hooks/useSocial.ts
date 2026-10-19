import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDTO, Page, PostDTO, ProfileDTO, PublicUser } from "@commune/shared";
import { api, withQuery } from "../lib/api";

export function useProfile(username: string) {
  return useQuery({
    queryKey: ["profile", username.toLowerCase()],
    queryFn: () => api<ProfileDTO>(`/users/${encodeURIComponent(username)}`),
  });
}

export function useUserPosts(username: string) {
  return useInfiniteQuery({
    queryKey: ["feed", "user", username.toLowerCase()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(
        withQuery(`/users/${encodeURIComponent(username)}/posts`, { cursor: pageParam }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useToggleFollow(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<ProfileDTO>(`/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),
    onSuccess: (profile) => {
      qc.setQueryData(["profile", username.toLowerCase()], profile);
      // The "Following" feed changes whenever the follow list changes.
      void qc.invalidateQueries({ queryKey: ["feed", "following"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bio: string) => api<PublicUser>("/users/me", { method: "PATCH", body: { bio } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationDTO[]>("/notifications"),
  });
}

/** Polls every 30 seconds while the tab is open. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/notifications/read", { method: "POST" }),
    // Only the badge is refreshed, so the page keeps showing which items were new.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unread-count"] }),
  });
}
