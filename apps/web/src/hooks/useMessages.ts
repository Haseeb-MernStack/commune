import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationDTO, MessageDTO, MessagePage } from "@commune/shared";
import { api } from "../lib/api";
import { isRealtimeConnected } from "../lib/realtime";
import { useAuth } from "../store/auth";

export type ThreadPage = MessagePage & { conversation?: ConversationDTO };

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<ConversationDTO[]>("/messages"),
    enabled,
    // The live connection delivers changes; polling is only a safety net while it is up.
    refetchInterval: () => (isRealtimeConnected() ? 120_000 : 15_000),
  });
}

/** Number of conversations with unread messages (for the badge). */
export function useUnreadMessages(enabled: boolean) {
  return useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => api<{ count: number }>("/messages/unread-count"),
    enabled,
    refetchInterval: () => (isRealtimeConnected() ? 180_000 : 30_000),
  });
}

/** The newest page of a conversation: live through the socket, re-checked every 4 seconds without it. */
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
    refetchInterval: () => (isRealtimeConnected() ? 60_000 : 4_000),
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export function loadOlder(id: string, cursor: string) {
  return api<MessagePage>(`/messages/${id}?cursor=${encodeURIComponent(cursor)}`);
}

/** Ids of messages that are still being sent start with this. */
export const PENDING_PREFIX = "tmp-";

/**
 * Sending shows the message at once ("optimistic"), then swaps in the saved one. If sending
 * fails the temporary message is removed and the error is shown, so nothing is silently lost.
 */
export function useSendMessage(id: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["thread", id];
  return useMutation({
    mutationFn: (text: string) =>
      api<MessageDTO>(`/messages/${id}`, { method: "POST", body: { text } }),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: key });
      const tempId = `${PENDING_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const temp: MessageDTO = {
        id: tempId,
        conversationId: id,
        senderId: user?.id ?? "",
        text,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ThreadPage>(key, (old) =>
        old
          ? {
              ...old,
              items: [...old.items, temp],
              conversation: old.conversation && { ...old.conversation, seenByOther: false },
            }
          : old,
      );
      return { tempId };
    },
    onSuccess: (saved, _text, ctx) => {
      qc.setQueryData<ThreadPage>(key, (old) => {
        if (!old) return old;
        // The live event may already have delivered the saved message; then just drop the temp one.
        const already = old.items.some((m) => m.id === saved.id);
        const items = already
          ? old.items.filter((m) => m.id !== ctx?.tempId)
          : old.items.map((m) => (m.id === ctx?.tempId ? saved : m));
        return { ...old, items };
      });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (_err, _text, ctx) => {
      qc.setQueryData<ThreadPage>(key, (old) =>
        old ? { ...old, items: old.items.filter((m) => m.id !== ctx?.tempId) } : old,
      );
    },
  });
}

/** Marks a conversation read (sent when a message arrives while the person is looking at it). */
export function useMarkRead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/messages/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["unread-messages"] });
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
