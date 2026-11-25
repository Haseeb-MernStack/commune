import mongoose from "mongoose";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";

/**
 * Link previews. Chat apps and social sites fetch a link without running our web app, so they would
 * only ever see the generic site tags. The web host sends those bots here (see apps/web/vercel.json)
 * and gets a tiny page with the right title, description and image.
 *
 * Only information that is already public is used: free post text, and a profile's name, bio and
 * photo. Paid posts and banned accounts never expose their content.
 */

const SITE = "Commune";
const DEFAULT_IMAGE = "/og-default.jpg";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

function absolute(url: string | null | undefined): string {
  if (!url) return env.CLIENT_ORIGIN + DEFAULT_IMAGE;
  if (/^https:\/\//i.test(url)) return url;
  return url.startsWith("/") ? env.CLIENT_ORIGIN + url : env.CLIENT_ORIGIN + DEFAULT_IMAGE;
}

interface Preview {
  title: string;
  description: string;
  image: string;
  path: string;
  card: "summary" | "summary_large_image";
}

export function renderPreview(p: Preview): string {
  const url = env.CLIENT_ORIGIN + p.path;
  const title = esc(p.title);
  const desc = esc(p.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:site_name" content="${SITE}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(p.image)}" />
<meta name="twitter:card" content="${p.card}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${esc(p.image)}" />
</head>
<body><p><a href="${esc(url)}">${title}</a></p></body>
</html>`;
}

function send(res: Response, status: number, html: string) {
  res
    .status(status)
    .type("html")
    .set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600")
    .send(html);
}

const generic: Preview = {
  title: `${SITE}: an open source community platform`,
  description: "Join the conversation on Commune, an open source community platform.",
  image: env.CLIENT_ORIGIN + DEFAULT_IMAGE,
  path: "/",
  card: "summary",
};

export async function postPreview(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return send(res, 404, renderPreview(generic));

  const post = await Post.findById(id)
    .select("content imageUrl priceCents author")
    .populate("author", "username banned")
    .lean<{
      content: string;
      imageUrl: string | null;
      priceCents: number | null;
      author: { username: string; banned?: boolean } | null;
    }>();
  if (!post?.author || post.author.banned) return send(res, 404, renderPreview(generic));

  const path = `/posts/${id}`;
  const name = post.author.username;
  if (post.priceCents != null) {
    return send(
      res,
      200,
      renderPreview({
        title: `${name} on ${SITE}`,
        description: "A paid post on Commune. Open it to unlock.",
        image: env.CLIENT_ORIGIN + DEFAULT_IMAGE,
        path,
        card: "summary",
      }),
    );
  }
  send(
    res,
    200,
    renderPreview({
      title: `${name} on ${SITE}`,
      description: clip(post.content, 200) || `A post by ${name} on ${SITE}.`,
      image: absolute(post.imageUrl),
      path,
      card: post.imageUrl ? "summary_large_image" : "summary",
    }),
  );
}

export async function userPreview(req: Request, res: Response) {
  const username = String(req.params.username);
  if (username.length > 24) return send(res, 404, renderPreview(generic));

  const user = await User.findOne({ username: new RegExp(`^${escapeRegex(username)}$`, "i") })
    .collation({ locale: "en", strength: 2 })
    .select("username bio avatarUrl banned")
    .lean<{ username: string; bio?: string; avatarUrl?: string | null; banned?: boolean }>();
  if (!user || user.banned) return send(res, 404, renderPreview(generic));

  // Always the lowercase name, so the shared address is the same one everywhere.
  const name = user.username.toLowerCase();
  send(
    res,
    200,
    renderPreview({
      title: `${name} on ${SITE}`,
      description: clip(user.bio ?? "", 200) || `See ${name}'s posts on ${SITE}.`,
      image: absolute(user.avatarUrl),
      path: `/u/${name}`,
      card: "summary",
    }),
  );
}
