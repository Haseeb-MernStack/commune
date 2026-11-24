import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlockedUserDTO, BlockKind } from "@commune/shared";
import { api } from "../lib/api";

export function useBlocks() {
  return useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<BlockedUserDTO[]>("/users/me/blocks"),
  });
}

/** Muting or blocking changes feeds, comments, search, notifications and messages. */
function useRefreshAfterBlock() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "blocks",
      "feed",
      "profile",
      "post",
      "comments",
      "search",
      "notifications",
      "unread-count",
      "conversations",
      "follows",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useSetBlock() {
  const refresh = useRefreshAfterBlock();
  return useMutation({
    mutationFn: ({ username, kind }: { username: string; kind: BlockKind }) =>
      api<void>(`/users/${encodeURIComponent(username)}/block`, { method: "PUT", body: { kind } }),
    onSuccess: refresh,
  });
}

export function useRemoveBlock() {
  const refresh = useRefreshAfterBlock();
  return useMutation({
    mutationFn: (username: string) =>
      api<void>(`/users/${encodeURIComponent(username)}/block`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}
