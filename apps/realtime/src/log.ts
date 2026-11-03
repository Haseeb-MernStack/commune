/**
 * Minimal JSON logger. Only ever pass ids, event names and error text: never tokens, secrets or
 * message content.
 */
type Level = "info" | "warn" | "error";

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ level, time: Date.now(), msg, ...fields });
  (level === "error" ? console.error : console.log)(line);
}
