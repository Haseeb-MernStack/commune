import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  FollowListItemDTO,
  NotificationDTO,
  Page,
  PostDTO,
  ProfileDTO,
  PublicUser,
  UpdateProfileInput,
} from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { useAuth } from "../store/auth";

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

export type FollowListKind = "followers" | "following";
type FollowLists = InfiniteData<Page<FollowListItemDTO>>;

/** A page at a time of the people who follow a user, or whom they follow. */
export function useFollowList(username: string, kind: FollowListKind) {
  return useInfiniteQuery({
    queryKey: ["follows", kind, username.toLowerCase()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<FollowListItemDTO>>(
        withQuery(`/users/${encodeURIComponent(username)}/${kind}`, { cursor: pageParam }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Flips the Follow / Following button for one person in every loaded list. */
function flipInLists(qc: ReturnType<typeof useQueryClient>, username: string) {
  const lower = username.toLowerCase();
  qc.setQueriesData<FollowLists>(
    { queryKey: ["follows"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((p) =>
            p.username.toLowerCase() === lower ? { ...p, followedByMe: !p.followedByMe } : p,
          ),
        })),
      },
  );
}

export function useToggleFollow(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<ProfileDTO>(`/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),
    // Lists react at once; if the request fails they go back to what they showed.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["follows"] });
      const before = qc.getQueriesData<FollowLists>({ queryKey: ["follows"] });
      flipInLists(qc, username);
      return { before };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.before.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (profile) => {
      qc.setQueryData(["profile", username.toLowerCase()], profile);
      // Counts on other profiles (and on yours) changed too.
      void qc.invalidateQueries({ queryKey: ["profile"] });
      // The "Following" feed changes whenever the follow list changes.
      void qc.invalidateQueries({ queryKey: ["feed", "following"] });
    },
  });
}

/** Updates the signed-in user's bio and/or avatar. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<PublicUser>("/users/me", { method: "PATCH", body: input }),
    onSuccess: (user) => {
      setUser(user);
      void qc.invalidateQueries({ queryKey: ["profile"] });
      // Avatars appear on posts and comments, so refresh those too.
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["post"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
    },
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
