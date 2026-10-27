import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load the repo-root .env during local development; real env vars win in production.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1),
  // The web app's address. A trailing slash is removed: browsers send Origin without one, and
  // CORS compares it exactly.
  CLIENT_ORIGIN: z
    .string()
    .url()
    .transform((v) => v.trim().replace(/\/+$/, "")),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Where uploaded images are stored. Relative paths resolve from the API's working directory.
  UPLOAD_DIR: z.string().default("uploads"),
  // How many reverse proxies sit in front of the API (used for correct client IPs in rate
  // limits). 1 = a single host proxy; 2 = Vercel rewrite in front of Render.
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Set all three to store images in Cloudinary instead of on local disk (needed on hosts
  // with an ephemeral disk, such as Render's free plan).
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Transactional email through Resend (https://resend.com). Without a key, emails are only
  // printed to the API log in development and are not sent in production.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z
    .string()
    .optional()
    .transform((v) => v?.trim() || "Commune <onboarding@resend.dev>"),
  // "Sign in with Google": the OAuth Web client ID (looks like 123-abc.apps.googleusercontent.com).
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Paid posts, through Lemon Squeezy (https://lemonsqueezy.com). All four are needed for real
  // checkouts. Outside production, with none set, purchases are simulated so you can test.
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_STORE_ID: z.string().optional(),
  LEMONSQUEEZY_VARIANT_ID: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  // Share of each sale the platform keeps; the rest is credited to the post's author.
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(20),
  // The lower share kept on sales by Commune Plus members.
  PLUS_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  // Commune Plus: id of the SUBSCRIPTION variant in Lemon Squeezy (a recurring product).
  LEMONSQUEEZY_PLUS_VARIANT_ID: z.string().optional(),
  // Shown on the Plus page. The real price lives in Lemon Squeezy; keep this text in sync.
  PLUS_PRICE_LABEL: z.string().optional().transform((v) => v?.trim() || "$5 / month"),
  // Where messages from the Contact page are emailed (needs RESEND_API_KEY). They are always
  // saved in the database too.
  CONTACT_EMAIL: z.string().optional().transform((v) => v?.trim() || undefined),
  // "true" blocks posting, liking, commenting and following until the email is verified.
  REQUIRE_VERIFIED_EMAIL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
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
