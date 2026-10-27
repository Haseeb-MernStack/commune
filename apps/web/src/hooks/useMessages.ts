import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationDTO, MessageDTO, MessagePage } from "@commune/shared";
import { api } from "../lib/api";

export type ThreadPage = MessagePage & { conversation?: ConversationDTO };

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<ConversationDTO[]>("/messages"),
    enabled,
    refetchInterval: 15_000,
  });
}

/** Number of conversations with unread messages (for the badge). */
export function useUnreadMessages(enabled: boolean) {
  return useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => api<{ count: number }>("/messages/unread-count"),
    enabled,
    refetchInterval: 30_000,
  });
}

/** The newest page of a conversation, re-checked every 4 seconds while the tab is open. */
export function useThread(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["thread", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const page = await api<ThreadPage>(`/messages/${id}`);
      // Opening a thread marks it read on the server, so refresh the badges when it mattered.
      if ((page.conversation?.unread ?? 0) > 0) {
        void qc.invalidateQueries({ queryKey: ["unread-messages"] });
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      }
      return page;
    },
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export function loadOlder(id: string, cursor: string) {
  return api<MessagePage>(`/messages/${id}?cursor=${encodeURIComponent(cursor)}`);
}

export function useSendMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<MessageDTO>(`/messages/${id}`, { method: "POST", body: { text } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["thread", id] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useStartChat(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<{ conversationId: string; message: MessageDTO }>(`/messages/with/${encodeURIComponent(username)}`, {
        method: "POST",
        body: { text },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
