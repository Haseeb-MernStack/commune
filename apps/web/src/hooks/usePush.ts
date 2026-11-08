import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PushPreferences, PushStatus } from "@commune/shared";
import { api } from "../lib/api";
import { currentSubscription, disablePush, enablePush, pushSupported } from "../lib/push";

export function usePushStatus() {
  return useQuery({
    queryKey: ["push-status"],
    queryFn: () => api<PushStatus>("/push/status"),
    staleTime: 60_000,
  });
}

/** Whether this particular device is subscribed. */
export function useDeviceSubscription() {
  return useQuery({
    queryKey: ["push-device"],
    queryFn: async () => (pushSupported() ? Boolean(await currentSubscription()) : false),
    staleTime: 0,
  });
}

export function useEnablePush(publicKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Notifications are not available right now");
      await enablePush(publicKey);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["push-device"] }),
  });
}

export function useDisablePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disablePush,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["push-device"] }),
  });
}

export function useSavePushPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: PushPreferences) =>
      api<void>("/push/preferences", { method: "PUT", body: prefs }),
    onMutate: async (prefs) => {
      qc.setQueryData<PushStatus>(["push-status"], (old) =>
        old ? { ...old, preferences: prefs } : old,
      );
    },
    onError: () => void qc.invalidateQueries({ queryKey: ["push-status"] }),
  });
}

export function useSendTestPush() {
  return useMutation({ mutationFn: () => api<void>("/push/test", { method: "POST" }) });
}
