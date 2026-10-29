import pino from "pino";
import { env } from "./env.js";

/**
 * Logs never need credentials, tokens, cookies or full headers. Request logging is reduced to
 * method, path and status (see app.ts); the redact list is a second safety net for anything that
 * is logged by hand.
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
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
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.authorization",
      "*.cookie",
      "*.signature",
      "*.apiKey",
      "*.secret",
    ],
    censor: "[Redacted]",
  },
});
