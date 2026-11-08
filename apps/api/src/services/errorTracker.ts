import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ErrorEvent } from "../models/ErrorEvent.js";
import { sendMail } from "./mailService.js";

export interface ErrorReport {
  source: "api" | "web";
  message: string;
  stack?: string;
  route?: string;
  status?: number | null;
}

/** Stored errors never contain tokens, emails or query strings, even if the message did. */
export function scrub(text: string): string {
  return text
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [token]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[token]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/([?&][\w%.-]+=)[^&\s"')]*/g, "$1[x]");
}

/** Makes "Cannot read x of 5f3a… in /posts/123" and the same error for another id one group. */
function normalize(text: string): string {
  return text
    .replace(/\b[a-f0-9]{24}\b/gi, ":id")
    .replace(/\b\d+\b/g, "N")
    .slice(0, 200);
}

export function fingerprintOf(report: ErrorReport): string {
  const firstFrame = (report.stack ?? "").split("\n").find((l) => /\bat\b|@/.test(l)) ?? "";
  return crypto
    .createHash("sha1")
    .update(
      [
        report.source,
        normalize(report.route ?? ""),
        normalize(report.message),
        normalize(firstFrame),
      ].join("|"),
    )
    .digest("hex");
}

// Anyone can post browser errors, so the table is capped: past this size only errors that are
// already known are counted, and new kinds are dropped.
const MAX_EVENTS = 2000;
let cachedCount = { at: 0, value: 0 };
async function eventCount(): Promise<number> {
  if (Date.now() - cachedCount.at > 60_000) {
    cachedCount = { at: Date.now(), value: await ErrorEvent.estimatedDocumentCount() };
  }
  return cachedCount.value;
}

// At most a few alert emails an hour, so an outage cannot flood the inbox.
const ALERTS_PER_HOUR = 5;
let alertTimes: number[] = [];
function canAlert(): boolean {
  const cutoff = Date.now() - 60 * 60 * 1000;
  alertTimes = alertTimes.filter((t) => t > cutoff);
  if (alertTimes.length >= ALERTS_PER_HOUR) return false;
  alertTimes.push(Date.now());
  return true;
}

/** Records an error and emails the owner the first time a new kind appears. Never throws. */
export async function recordError(report: ErrorReport): Promise<void> {
  if (env.NODE_ENV === "test") return;
  try {
    const clean = {
      source: report.source,
      message: scrub(report.message).slice(0, 300),
      stack: scrub(report.stack ?? "").slice(0, 2000),
      route: scrub(report.route ?? "").slice(0, 200),
      status: report.status ?? null,
    };
    const fingerprint = fingerprintOf(clean);
    const now = new Date();
    const known = await ErrorEvent.findOneAndUpdate(
      { fingerprint },
      { $inc: { count: 1 }, $set: { lastSeen: now, resolved: false } },
    ).lean();
    if (known) return;
    if ((await eventCount()) >= MAX_EVENTS) return;

    await ErrorEvent.create({ fingerprint, ...clean, firstSeen: now, lastSeen: now });
    cachedCount.value += 1;

    const to = env.ALERT_EMAIL ?? env.CONTACT_EMAIL;
    if (to && canAlert()) {
      await sendMail({
        to,
        subject: `Commune error: ${clean.message}`.slice(0, 120),
        text: `A new error appeared.\n\nWhere: ${clean.source} ${clean.route}\nMessage: ${clean.message}\n\nSee the Errors tab on the Admin page.`,
        html: `<p>A new error appeared.</p><p><strong>${esc(clean.source)}</strong> ${esc(clean.route)}<br>${esc(clean.message)}</p><p>See the Errors tab on the Admin page.</p>`,
      });
    }
  } catch (err) {
    // Monitoring must never break the request that triggered it. Duplicate-key races end here.
    logger.warn({ err: String(err) }, "Could not record error");
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
