import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { logger } from "./config/logger.js";

// Serverless entry point (Vercel). The Express app is created once per warm instance and the
// MongoDB connection is reused between requests instead of being opened for every one.
const app = createApp();
let ready: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    ready ??= connectDb();
    await ready;
  } catch (err) {
    ready = null; // try again on the next request
    logger.error({ err }, "Database connection failed");
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Service temporarily unavailable" }));
    return;
  }
  app(req, res);
}
