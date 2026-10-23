import { useMutation, useQuery } from "@tanstack/react-query";
import type { CheckoutResponse, EarningsDTO } from "@commune/shared";
import { api } from "../lib/api";

/** Starts a purchase and sends the browser to the payment page. */
export function useCheckout() {
  return useMutation({
    mutationFn: (postId: string) =>
      api<CheckoutResponse>(`/posts/${postId}/checkout`, { method: "POST" }),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}

export function useEarnings(enabled: boolean) {
  return useQuery({
    queryKey: ["earnings"],
    queryFn: () => api<EarningsDTO>("/users/me/earnings"),
    enabled,
  });
}

export const formatPrice = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
