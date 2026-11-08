import { log } from "./log.js";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface Entry {
  participants: string[] | null;
  expires: number;
}

const FOUND_TTL_MS = 5 * 60 * 1000; // a conversation's two people never change
const MISSING_TTL_MS = 30 * 1000;
const MAX_ENTRIES = 5000;

/**
 * Asks the API who is in a conversation, so a socket can only join, type in or watch the
 * presence of conversations it really belongs to. This service holds no database credentials.
 */
export class Membership {
  private cache = new Map<string, Entry>();

  constructor(
    private readonly apiUrl: string,
    private readonly secret: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async participants(conversationId: string): Promise<string[] | null> {
    const hit = this.cache.get(conversationId);
    if (hit && hit.expires > Date.now()) return hit.participants;

    try {
      const res = await this.fetchImpl(
        `${this.apiUrl}/api/internal/conversations/${conversationId}/participants`,
        {
          headers: { Authorization: `Bearer ${this.secret}` },
          signal: AbortSignal.timeout(4000),
        },
      );
      if (res.status === 404) return this.remember(conversationId, null, MISSING_TTL_MS);
      if (!res.ok) {
        log("warn", "Membership lookup failed", { status: res.status });
        return null; // not cached: try again next time
      }
      const body = (await res.json()) as { participants?: unknown };
      if (
        !Array.isArray(body.participants) ||
        !body.participants.every((p) => typeof p === "string")
      )
        return null;
      return this.remember(conversationId, body.participants as string[], FOUND_TTL_MS);
    } catch (err) {
      log("warn", "Membership lookup error", { err: String(err) });
      return null;
    }
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    return (await this.participants(conversationId))?.includes(userId) ?? false;
  }

  private remember(id: string, participants: string[] | null, ttl: number) {
    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.cache.set(id, { participants, expires: Date.now() + ttl });
    return participants;
  }
}
