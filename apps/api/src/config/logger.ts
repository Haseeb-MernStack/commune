import pino from "pino";
import { env } from "./env.js";

/**
 * Logs never need credentials, tokens, cookies or full headers. Request logging is reduced to
 * method, path and status (see app.ts); the redact list is a second safety net for anything that
 * is logged by hand.
 *
 * The level comes from LOG_LEVEL when it is set, otherwise silent in tests, info in production
 * and debug in development. In development the output is pretty-printed; everywhere else it is
 * one JSON object per line.
 */
/** The level to use when LOG_LEVEL is not set. */
function defaultLevel(): "silent" | "info" | "debug" {
  if (env.NODE_ENV === "test") return "silent";
  if (env.NODE_ENV === "production") return "info";
  return "debug";
}

export const loggerOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL ?? defaultLevel(),
  redact: {
    paths: [
      "req.headers",
      "res.headers",
      "headers",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
      "email",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.authorization",
      "*.cookie",
      "*.email",
      "*.signature",
      "*.apiKey",
      "*.secret",
    ],
    censor: "[Redacted]",
  },
};

// Pretty output in development only: tests stay silent and production stays JSON.
if (env.NODE_ENV === "development") {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: { colorize: true },
  };
}

export const logger = pino(loggerOptions);
