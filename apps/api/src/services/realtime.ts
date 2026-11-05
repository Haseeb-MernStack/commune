import type { PushedEvent } from "@commune/shared";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Pushes live events to the realtime (Socket.IO) service. Serverless functions cannot hold
 * WebSocket connections, so they tell that service to deliver instead.
 *
 * Delivery is best effort and never throws: the message is already saved, and clients fall back
 * to polling and refetch when they reconnect. After a failure the service is skipped for a short
 * while (a circuit breaker), so an outage there never slows down sending messages.
 */
const TIMEOUT_MS = 1200;
const BACKOFF_MS = 20_000;
let skipUntil = 0;

async function post<T = null>(path: string, body: unknown): Promise<T | null> {
  if (!env.REALTIME_URL || !env.REALTIME_SECRET) return null;
  if (Date.now() < skipUntil) return null;
  try {
    const res = await fetch(`${env.REALTIME_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.REALTIME_SECRET}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.status === 204 ? null : ((await res.json()) as T);
  } catch (err) {
    skipUntil = Date.now() + BACKOFF_MS;
    logger.warn({ err: String(err) }, "Realtime service unreachable");
    return null;
  }
}

/** Sends an event to every open tab and device of these users. */
export async function emitToUsers(userIds: Array<string | { toString(): string }>, event: PushedEvent, payload: unknown = {}) {
  const to = [...new Set(userIds.map((id) => id.toString()))];
  if (to.length === 0) return;
  await post("/internal/emit", { to, event, payload });
}

/** Closes every live connection of a user (used when an account is suspended). */
export async function disconnectUser(userId: string) {
  await post("/internal/disconnect", { userId });
}

/**
 * Which of these users have the site open and visible right now (so a push notification would
 * only duplicate what they already see). If the service cannot be reached, nobody counts as
 * active and the push is sent.
 */
export async function activeUsers(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const res = await post<{ active?: string[] }>("/internal/active", { userIds });
  return new Set(Array.isArray(res?.active) ? res.active : []);
}

/** For tests. */
export function resetRealtimeBreaker() {
  skipUntil = 0;
}
