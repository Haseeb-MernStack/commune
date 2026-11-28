import { randomUUID } from "node:crypto";

/** Safe incoming X-Request-Id format: 1-64 ASCII letters, numbers, or hyphens. */
const REQUEST_ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

/** Returns the value if it is a safe request ID string, otherwise undefined. */
export function validRequestId(value: unknown): string | undefined {
  return typeof value === "string" && REQUEST_ID_RE.test(value) ? value : undefined;
}

/** Returns a safe incoming X-Request-Id header value or generates a fresh UUID v4. */
export function resolveRequestId(header: unknown): string {
  return validRequestId(header) ?? randomUUID();
}
