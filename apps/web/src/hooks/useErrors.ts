import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ErrorEventDTO } from "@commune/shared";
import { api } from "../lib/api";

export function useErrorEvents(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-errors"],
    queryFn: () => api<ErrorEventDTO[]>("/admin/errors"),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useResolveError() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/errors/${id}/resolve`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-errors"] }),
  });
}
