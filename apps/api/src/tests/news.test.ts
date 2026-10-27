import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { cleanText, clearNewsCache, getNews, mergeItems, parseFeed, safeUrl } from "../services/newsService.js";

const app = createApp();

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Markets rally &amp; recover]]></title><link>https://example.com/a</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Second story</title><link>https://example.com/b</link><pubDate>Mon, 26 Oct 2026 11:00:00 GMT</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Mon, 26 Oct 2026 11:00:00 GMT</pubDate></item>
<item><title>No date</title><link>https://example.com/c</link></item>
</channel></rss>`;

const ATOM = `<feed><entry><title>Atom story</title><link rel="alternate" href="https://example.com/atom"/><updated>2026-10-26T12:00:00Z</updated></entry></feed>`;

beforeEach(() => clearNewsCache());
afterEach(() => vi.unstubAllGlobals());

describe("news parsing", () => {
  it("cleans CDATA, entities and tags", () => {
    expect(cleanText("<![CDATA[A &amp; B &#39;c&#39; <b>bold</b>]]>")).toBe("A & B 'c' bold");
    expect(cleanText("x &#x41; &mdash; y")).toBe("x A — y");
  });

  it("only accepts http(s) links", () => {
    expect(safeUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });

  it("parses RSS, skipping items with bad links or dates", () => {
    const items = parseFeed(RSS, "Test");
    expect(items.map((i) => i.title)).toEqual(["Markets rally & recover", "Second story"]);
    expect(items[0]).toMatchObject({ source: "Test", link: "https://example.com/a" });
    expect(items[0]!.id).toHaveLength(16);
  });

  it("parses Atom", () => {
    const [item] = parseFeed(ATOM, "Atom");
    expect(item).toMatchObject({ title: "Atom story", link: "https://example.com/atom" });
  });

  it("returns nothing for garbage", () => {
    expect(parseFeed("<html>nope</html>", "x")).toEqual([]);
  });

  it("merges newest first and drops duplicate headlines", () => {
    const a = parseFeed(RSS, "A");
    const dup = parseFeed(RSS.replace("https://example.com/b", "https://other.com/b"), "B");
    const merged = mergeItems([a, dup], Date.parse("2026-10-27T00:00:00Z"));
    expect(merged.map((i) => i.title)).toEqual(["Second story", "Markets rally & recover"]);
  });

  it("drops items dated far in the future", () => {
    const merged = mergeItems([parseFeed(RSS, "A")], Date.parse("2026-10-26T10:30:00Z"));
    expect(merged.map((i) => i.title)).toEqual(["Markets rally & recover"]);
  });
});

describe("getNews cache", () => {
  it("fetches once, then serves from cache", async () => {
    const fetchMock = vi.fn(async () => new Response(RSS, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getNews("top");
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    await getNews("top");
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("survives one failing feed", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return n === 1 ? new Response("", { status: 500 }) : new Response(RSS, { status: 200 });
      }),
    );
    expect((await getNews("world")).length).toBeGreaterThan(0);
  });

  it("throws when every feed fails and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(getNews("sport")).rejects.toThrow();
  });
});

describe("GET /api/news", () => {
  it("is public and returns items with cache headers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(RSS, { status: 200 })));
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage=600");
    expect(res.body[0]).toHaveProperty("title");
  });

  it("rejects unknown topics", async () => {
    expect((await request(app).get("/api/news?topic=gossip")).status).toBe(400);
  });

  it("answers 503 without leaking details when feeds are down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("secret network detail"); }));
    const res = await request(app).get("/api/news?topic=business");
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
