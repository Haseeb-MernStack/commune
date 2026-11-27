import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions } from "../config/logger.js";

/**
 * The API logger must never print secrets. These tests log values that look like real secrets
 * through the shared logger options and read the output back.
 */
describe("logger redaction", () => {
  it("never prints a password or an Authorization header", async () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    // The shared options resolve to level "silent" in tests, so this logger turns the level
    // back up; only the redaction config is under test here.
    const testLogger = pino({ ...loggerOptions, level: "info" }, stream);
    testLogger.info(
      {
        password: "super-secret-password",
        email: "someone@example.com",
        authorization: "Bearer secret-token",
        headers: { authorization: "Bearer secret-token", cookie: "session=abc123" },
        user: { password: "nested-secret-password", email: "nested@example.com" },
      },
      "login attempt",
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(output).toContain("login attempt");
    expect(output).not.toContain("super-secret-password");
    expect(output).not.toContain("nested-secret-password");
    expect(output).not.toContain("Bearer secret-token");
    expect(output).not.toContain("session=abc123");
    expect(output).not.toContain("someone@example.com");
    expect(output).not.toContain("nested@example.com");
    expect(output).toContain("[Redacted]");
  });
});
