/**
 * Crawlers and agents run by AI companies, matched against the User-Agent header. Search engines
 * (Googlebot, Bingbot), the AdSense checker and link-preview fetchers are deliberately NOT here.
 *
 * Keep this list in step with public/robots.txt and vercel.json in the web app; a test fails if
 * they drift apart.
 */
export const AI_BOT_NAMES = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "YouBot",
  "Timpibot",
  "DuckAssistBot",
  "MistralAI-User",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "PanguBot",
  "Kangaroo Bot",
  "Webzio-Extended",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One case-insensitive pattern for all of them. */
export const AI_BOT_PATTERN = new RegExp(AI_BOT_NAMES.map(escape).join("|"), "i");

export const isAiBot = (userAgent: string | undefined): boolean =>
  Boolean(userAgent) && AI_BOT_PATTERN.test(userAgent as string);
