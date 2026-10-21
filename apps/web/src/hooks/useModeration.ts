import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateReportInput,
  Page,
  ReportDTO,
  ReportStatus,
  ResolveReportInput,
} from "@commune/shared";
import { api, withQuery } from "../lib/api";

export function useReportPost(postId: string) {
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      api<{ ok: true }>(`/posts/${postId}/report`, { method: "POST", body: input }),
  });
}

export function useAdminReports(status: ReportStatus) {
  return useInfiniteQuery({
    queryKey: ["admin-reports", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<ReportDTO>>(withQuery("/admin/reports", { status, cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Moderation changes posts, profiles and the queue, so refresh all of them. */
function useRefreshAfterModeration() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["admin-reports", "feed", "post", "comments", "profile"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useDismissReport() {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/reports/${id}/dismiss`, { method: "POST" }),
    onSuccess: refresh,
  });
}

export function useResolveReport() {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: ({ id, action }: { id: string } & ResolveReportInput) =>
      api<void>(`/admin/reports/${id}/resolve`, { method: "POST", body: { action } }),
    onSuccess: refresh,
  });
}

export function useBanUser(username: string) {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: (removePosts: boolean) =>
      api<void>(`/admin/users/${encodeURIComponent(username)}/ban`, {
        method: "POST",
        body: { removePosts },
      }),
    onSuccess: refresh,
  });
}

export function useUnbanUser(username: string) {
  const refresh = useRefreshAfterModeration();
  return useMutation({
    mutationFn: () =>
      api<void>(`/admin/users/${encodeURIComponent(username)}/unban`, { method: "POST" }),
    onSuccess: refresh,
  });
}
