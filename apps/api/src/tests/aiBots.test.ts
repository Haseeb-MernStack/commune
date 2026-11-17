import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { AI_BOT_NAMES, isAiBot } from "../config/aiBots.js";

const app = createApp();
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("AI crawler blocking", () => {
  it("recognises AI crawlers whatever the letter case", () => {
    expect(isAiBot("Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toBe(true);
    expect(isAiBot("Mozilla/5.0 AppleWebKit/537.36 (compatible; ClaudeBot/1.0)")).toBe(true);
    expect(isAiBot("perplexitybot")).toBe(true);
  });

  it("leaves search engines, ad checks, link previews and browsers alone", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mediapartners-Google",
      "facebookexternalhit/1.1",
      "Twitterbot/1.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "curl/8.5.0",
    ]) {
      expect(isAiBot(ua), ua).toBe(false);
    }
    expect(isAiBot(undefined)).toBe(false);
  });

  it("refuses an AI crawler on the API with 403", async () => {
    const res = await request(app).get("/api/news").set("User-Agent", "Mozilla/5.0 GPTBot/1.2");
    expect(res.status).toBe(403);
    expect(res.headers["x-robots-tag"]).toMatch(/noai/);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("refuses an AI crawler on uploads", async () => {
    const res = await request(app).get("/uploads/abc.jpg").set("User-Agent", "ClaudeBot/1.0");
    expect(res.status).toBe(403);
  });

  it("serves a normal browser as before", async () => {
    const res = await request(app)
      .get("/api/nothing-here")
      .set("User-Agent", "Mozilla/5.0 Chrome/120");
    expect(res.status).not.toBe(403);
  });

  it("is listed in robots.txt and the web host rule, so the three never drift apart", () => {
    const robots = read("../../../web/public/robots.txt");
    const vercel = read("../../../web/vercel.json");
    for (const name of AI_BOT_NAMES) {
      expect(robots, `robots.txt: ${name}`).toContain(`User-agent: ${name}\nDisallow: /`);
      expect(vercel, `vercel.json: ${name}`).toContain(name);
    }
  });
});
