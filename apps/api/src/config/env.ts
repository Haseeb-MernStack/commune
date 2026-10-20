import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load the repo-root .env during local development; real env vars win in production.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGIN: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Where uploaded images are stored. Relative paths resolve from the API's working directory.
  UPLOAD_DIR: z.string().default("uploads"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
