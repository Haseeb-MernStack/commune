import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { uploadUrlSchema } from "@commune/shared";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { asyncHandler } from "./utils/errors.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { lemonSqueezyWebhook, rawBody } from "./controllers/paymentController.js";
import { router } from "./routes/index.js";
import { cloudImageUrl, uploadDir, usesCloudStorage } from "./services/uploadService.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Needed for correct client IPs (rate limiting) behind reverse proxies. Set TRUST_PROXY to
  // the number of proxies in front of the API (2 for a Vercel rewrite in front of Render).
  app.set("trust proxy", env.TRUST_PROXY);

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
  if (usesCloudStorage) {
    app.get("/uploads/:file", (req, res) => {
      const file = req.params.file ?? "";
      if (!uploadUrlSchema.safeParse(`/uploads/${file}`).success) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.set("Cache-Control", "public, max-age=2592000, immutable");
      res.redirect(302, cloudImageUrl(file));
    });
  } else {
    app.use(
      "/uploads",
      express.static(uploadDir, {
        index: false,
        dotfiles: "ignore",
        maxAge: "30d",
        immutable: true,
      }),
    );
  }

  // The payment webhook needs the raw bytes to check the provider's signature, so it is
  // registered before the JSON parser.
  app.post("/api/webhooks/lemonsqueezy", rawBody, asyncHandler(lemonSqueezyWebhook));

  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
