import path from "node:path";
import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { createRealtimeServer } from "./server.js";

// Local development: read the repo-root .env. In production real environment variables win.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const { httpServer, close } = createRealtimeServer(config);
httpServer.listen(config.port, "0.0.0.0", () => {
  log("info", "Realtime server listening", { port: config.port });
});

const shutdown = (signal: string) => {
  log("info", "Shutting down", { signal });
  void close().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
