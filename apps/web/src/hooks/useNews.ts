import { useQuery } from "@tanstack/react-query";
import type { NewsItemDTO, NewsTopic } from "@commune/shared";
import { api } from "../lib/api";

/** Live headlines. The API caches for 10 minutes, so checking every 5 is cheap. */
export function useNews(topic: NewsTopic = "top") {
  return useQuery({
    queryKey: ["news", topic],
    queryFn: () => api<NewsItemDTO[]>(`/news?topic=${topic}`),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
