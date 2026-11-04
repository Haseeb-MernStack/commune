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

async function post(path: string, body: unknown): Promise<void> {
  if (!env.REALTIME_URL || !env.REALTIME_SECRET) return;
  if (Date.now() < skipUntil) return;
  try {
    const res = await fetch(`${env.REALTIME_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.REALTIME_SECRET}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    skipUntil = Date.now() + BACKOFF_MS;
    logger.warn({ err: String(err) }, "Realtime service unreachable");
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

/** For tests. */
export function resetRealtimeBreaker() {
  skipUntil = 0;
}
