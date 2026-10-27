import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { BillingDTO, CheckoutResponse, InsightsDTO, PublicUser } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/**
 * Billing state. With `waitForActivation` (right after returning from checkout) it re-checks
 * every 2 seconds until Plus is active, because the payment webhook arrives a moment later.
 */
export function useBilling(waitForActivation = false) {
  const { user, setUser } = useAuth();
  const query = useQuery({
    queryKey: ["billing"],
    queryFn: () => api<BillingDTO>("/billing"),
    refetchInterval: (q) => (waitForActivation && !q.state.data?.plus ? 2000 : false),
  });

  // Keep the logged-in user (and so every badge and limit in the UI) in step with the server.
  const plus = query.data?.plus;
  useEffect(() => {
    if (plus === undefined || !user || user.plus === plus) return;
    void api<PublicUser>("/users/me").then(setUser).catch(() => undefined);
  }, [plus, user, setUser]);

  return query;
}

/** Sends the browser to a hosted page (checkout or customer portal) returned by the API. */
const goTo = ({ url }: CheckoutResponse) => {
  window.location.assign(url);
};

export function useUpgrade() {
  return useMutation({
    mutationFn: () => api<CheckoutResponse>("/billing/checkout", { method: "POST" }),
    onSuccess: goTo,
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => api<CheckoutResponse>("/billing/portal", { method: "POST" }),
    onSuccess: goTo,
  });
}

export function useInsights(enabled: boolean) {
  return useQuery({
    queryKey: ["insights"],
    queryFn: () => api<InsightsDTO>("/insights"),
    enabled,
    staleTime: 60_000,
  });
}

/** Records that the current user opened a post (once per day on the server side). */
export function useTrackView(postId: string) {
  useEffect(() => {
    if (!postId) return;
    void api(`/posts/${postId}/view`, { method: "POST" }).catch(() => undefined);
  }, [postId]);
}
