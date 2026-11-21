import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { ClientErrorInput, ErrorEventDTO } from "@commune/shared";
import { ErrorEvent } from "../models/ErrorEvent.js";
import { recordError } from "../services/errorTracker.js";
import { notFound } from "../utils/errors.js";

/** Liveness: the process is up. Cheap, no database. */
export function live(_req: Request, res: Response) {
  res.json({ status: "ok" });
}

/** Readiness: the database answers. Point an uptime monitor here. Says nothing else. */
export async function ready(_req: Request, res: Response) {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) throw new Error("down");
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "degraded" });
  }
}

/** Errors reported by the browser. Public (errors can happen before login), rate limited. */
export async function reportClientError(req: Request, res: Response) {
  const body = req.body as ClientErrorInput;
  await recordError({
    source: "web",
    message: body.message,
    stack: body.stack,
    route: body.path.split("?")[0],
  });
  res.status(204).end();
}

/** Keeps only the scheme and host of a URL, so reports never carry paths, tokens or queries. */
function originOnly(value: unknown): string {
  if (typeof value !== "string" || !value) return "unknown";
  if (["inline", "eval", "data", "blob", "self", "wasm-eval"].includes(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol;
  } catch {
    return "unknown";
  }
}

/**
 * Turns a browser's Content-Security-Policy report into one short line. Handles both formats:
 * the older `{ "csp-report": {...} }` and the newer Reporting API list of `{ body: {...} }`.
 */
export function describeViolation(payload: unknown): { message: string; route: string } | null {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const raw = (first as { "csp-report"?: unknown; body?: unknown } | null) ?? null;
  const report = (raw?.["csp-report"] ?? raw?.body) as Record<string, unknown> | undefined;
  if (!report || typeof report !== "object") return null;

  const directive = String(report["effective-directive"] ?? report.effectiveDirective ?? "").slice(
    0,
    40,
  );
  const blocked = originOnly(report["blocked-uri"] ?? report.blockedURL ?? report.blockedUri);
  if (!directive) return null;
  const mode = report.disposition === "enforce" ? "blocked" : "would block";
  let route = "";
  try {
    route = new URL(String(report["document-uri"] ?? report.documentURL ?? "")).pathname;
  } catch {
    route = "";
  }
  return { message: `${directive} ${mode} ${blocked}`, route };
}

/** Receives Content-Security-Policy reports. Public (browsers send them), rate limited. */
export async function reportCsp(req: Request, res: Response) {
  const found = describeViolation(req.body);
  if (found) await recordError({ source: "csp", message: found.message, route: found.route });
  res.status(204).end();
}

function toDTO(e: {
  _id: unknown;
  source: string;
  message: string;
  route?: string | null;
  status?: number | null;
  stack?: string | null;
  count?: number | null;
  firstSeen: Date;
  lastSeen: Date;
  resolved?: boolean | null;
}): ErrorEventDTO {
  return {
    id: String(e._id),
    source: e.source === "web" ? "web" : "api",
    message: e.message,
    route: e.route ?? "",
    status: e.status ?? null,
    stack: e.stack ?? "",
    count: e.count ?? 1,
    firstSeen: e.firstSeen.toISOString(),
    lastSeen: e.lastSeen.toISOString(),
    resolved: Boolean(e.resolved),
  };
}

export async function listErrors(_req: Request, res: Response) {
  const rows = await ErrorEvent.find({ resolved: false }).sort({ lastSeen: -1 }).limit(100).lean();
  res.json(rows.map(toDTO));
}

export async function resolveError(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) throw notFound("Error not found");
  const result = await ErrorEvent.updateOne({ _id: id }, { $set: { resolved: true } });
  if (result.matchedCount === 0) throw notFound("Error not found");
  res.status(204).end();
}
