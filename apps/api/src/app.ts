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
import { uploadDir } from "./services/uploadService.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Needed for correct client IPs (rate limiting) behind a reverse proxy.
  app.set("trust proxy", 1);

  app.use(pinoHttp({ logger }));
  app.use(
    helmet({
      // The web app runs on another origin and must be allowed to display uploaded images.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(globalLimiter);

  // Uploaded images. File names are random, so they can be cached for a long time.
  // Helmet already sets X-Content-Type-Options: nosniff on these responses.
  app.use(
    "/uploads",
    express.static(uploadDir, { index: false, dotfiles: "ignore", maxAge: "30d", immutable: true }),
  );

  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
