import { logger } from "./logger.js";
import { recordError } from "../services/errorTracker.js";

/** Writes the problem to the error log without ever throwing or hanging the process. */
async function report(err: unknown, label: string) {
  const e = err instanceof Error ? err : new Error(String(err));
  try {
    await Promise.race([
      recordError({ source: "api", message: `${label}: ${e.message || e.name}`, stack: e.stack }),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // Reporting is best effort: the log line below is the record that always exists.
  }
}

/**
 * For the long-running server (not the serverless handler, where each request is its own
 * short life). Without these, a rejected promise nobody awaited, or a throw in a timer, only
 * leaves a bare Node message, or kills the process with no trace in Admin → Errors.
 */
export function installProcessHandlers(): void {
  // A forgotten await (for example in background work after a response) is logged and counted,
  // and the server keeps running: it is a bug to fix, not a reason to drop everyone's requests.
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    void report(reason, "Unhandled rejection");
  });

  // After an uncaught exception the process state can no longer be trusted. Record it, then
  // exit so the host (Render, Docker) starts a clean copy.
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception, exiting");
    void report(err, "Uncaught exception").finally(() => process.exit(1));
  });
}
