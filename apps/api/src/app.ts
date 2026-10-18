import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { router } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Needed for correct client IPs (rate limiting) behind a reverse proxy.
  app.set("trust proxy", 1);

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(globalLimiter);
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
