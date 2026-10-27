import { createHash } from "node:crypto";
import type { NewsItemDTO, NewsTopic } from "@commune/shared";
import { logger } from "../config/logger.js";

/**
 * Live English news from the public RSS feeds of established publishers. Only the headline,
 * link, source name and time are used; every item links out to the publisher's own page.
 */
interface Feed {
  source: string;
  url: string;
}

export const FEEDS: Record<NewsTopic, Feed[]> = {
  top: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/international/rss" },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
  world: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  ],
  technology: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/uk/technology/rss" },
    { source: "NPR", url: "https://feeds.npr.org/1019/rss.xml" },
  ],
  business: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/uk/business/rss" },
    { source: "NPR", url: "https://feeds.npr.org/1006/rss.xml" },
  ],
  sport: [
    { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/uk/sport/rss" },
  ],
};

const FRESH_MS = 10 * 60 * 1000; // serve from cache for 10 minutes
const STALE_MS = 6 * 60 * 60 * 1000; // if every feed fails, an older copy is still better than nothing
const MAX_ITEMS = 30;
const MAX_PER_SOURCE = 12;
const MAX_FEED_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 5000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

/** Removes CDATA wrappers and tags, decodes entities and collapses whitespace. */
export function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function safeChar(code: number): string {
  try {
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1]! : null;
}

/** Accepts only absolute http(s) links, so a feed can never inject a javascript: URL. */
export function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(cleanText(raw));
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Parses an RSS 2.0 or Atom document into items. Bad items are skipped, never thrown on. */
export function parseFeed(xml: string, source: string): NewsItemDTO[] {
  const items: NewsItemDTO[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = cleanText(tag(block, "title") ?? "");
    let link = safeUrl(tag(block, "link"));
    if (!link) {
      // Atom: <link href="..." rel="alternate" />
      const href = /<link[^>]*\shref=["']([^"']+)["'][^>]*>/i.exec(block);
      link = safeUrl(href ? href[1]! : null);
    }
    const dateRaw = tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date");
    const time = dateRaw ? Date.parse(cleanText(dateRaw)) : NaN;
    if (!title || !link || Number.isNaN(time)) continue;
    items.push({
      id: createHash("sha1").update(link).digest("hex").slice(0, 16),
      title: title.slice(0, 240),
      link,
      source,
      publishedAt: new Date(time).toISOString(),
    });
  }
  return items;
}

async function fetchFeed(feed: Feed): Promise<NewsItemDTO[]> {
  const res = await fetch(feed.url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "CommuneNewsBot/1.0 (+https://commune-mu.vercel.app)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_FEED_BYTES) throw new Error("feed too large");
  const xml = (await res.text()).slice(0, MAX_FEED_BYTES);
  return parseFeed(xml, feed.source).slice(0, MAX_PER_SOURCE);
}

/** Newest first, one entry per headline, capped. */
export function mergeItems(lists: NewsItemDTO[][], now = Date.now()): NewsItemDTO[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((i) => Date.parse(i.publishedAt) <= now + 10 * 60 * 1000) // ignore far-future dates
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((i) => {
      const key = i.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);
}

interface CacheEntry {
  items: NewsItemDTO[];
  at: number;
}
const cache = new Map<NewsTopic, CacheEntry>();
const inFlight = new Map<NewsTopic, Promise<NewsItemDTO[]>>();

export function clearNewsCache() {
  cache.clear();
  inFlight.clear();
}

async function refresh(topic: NewsTopic): Promise<NewsItemDTO[]> {
  const results = await Promise.allSettled(FEEDS[topic].map(fetchFeed));
  const lists: NewsItemDTO[][] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") lists.push(r.value);
    else logger.warn({ feed: FEEDS[topic][i]!.url, err: String(r.reason) }, "News feed failed");
  });
  const items = mergeItems(lists);
  if (items.length === 0) throw new Error("No news feeds could be read");
  cache.set(topic, { items, at: Date.now() });
  return items;
}

/** Returns cached news when fresh, otherwise refreshes (one request at a time per topic). */
export async function getNews(topic: NewsTopic): Promise<NewsItemDTO[]> {
  const hit = cache.get(topic);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.items;

  let pending = inFlight.get(topic);
  if (!pending) {
    pending = refresh(topic).finally(() => inFlight.delete(topic));
    inFlight.set(topic, pending);
  }
  try {
    return await pending;
  } catch (err) {
    if (hit && Date.now() - hit.at < STALE_MS) return hit.items;
    throw err;
  }
}
