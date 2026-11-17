import { QuotaLog } from "../models/QuotaLog.js";
import { AppError } from "../utils/errors.js";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export interface Window {
  limit: number;
  windowMs: number;
}

export interface QuotaRule {
  bucket: string;
  subject: string;
  windows: Window[];
}

export class QuotaError extends AppError {
  constructor(message = "Too many requests, please try again later.") {
    super(429, message);
  }
}

const waitText = (ms: number) => (ms >= DAY ? "a day" : ms >= HOUR ? "an hour" : "a few minutes");

/**
 * Counts one use against every rule and refuses (429) if any window is over its limit. The uses
 * are recorded first and then counted, so many requests arriving at the same moment cannot all
 * slip under the limit; a refused request removes its own rows again.
 */
export async function consumeQuota(rules: QuotaRule[], message?: string): Promise<void> {
  if (rules.length === 0) return;
  const rows = await QuotaLog.insertMany(
    rules.map((r) => ({ bucket: r.bucket, subject: r.subject.toLowerCase().slice(0, 200) })),
  );
  const now = Date.now();
  let exceeded: Window | null = null;
  for (const rule of rules) {
    for (const w of rule.windows) {
      const used = await QuotaLog.countDocuments({
        bucket: rule.bucket,
        subject: rule.subject.toLowerCase().slice(0, 200),
        createdAt: { $gte: new Date(now - w.windowMs) },
      });
      if (used > w.limit) {
        // Report the longest window that is full, so "try again" is honest.
        if (!exceeded || w.windowMs > exceeded.windowMs) exceeded = w;
      }
    }
  }
  if (exceeded) {
    await QuotaLog.deleteMany({ _id: { $in: rows.map((r) => r._id) } });
    throw new QuotaError(
      message ?? `Limit reached. Please try again in ${waitText(exceeded.windowMs)}.`,
    );
  }
}
