import os from "node:os";
import path from "node:path";
import { beforeEach, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/commune-test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-123";
// A real .env (loaded by the config) must never change test behaviour: blank values win over
// the file, so tests always use local-disk uploads, no email provider and no verification gate.
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";
process.env.RESEND_API_KEY = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.LEMONSQUEEZY_API_KEY = "";
process.env.LEMONSQUEEZY_STORE_ID = "";
process.env.LEMONSQUEEZY_VARIANT_ID = "";
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "";
process.env.PLATFORM_FEE_PERCENT = "20";
process.env.PLUS_FEE_PERCENT = "10";
process.env.LEMONSQUEEZY_PLUS_VARIANT_ID = "";
process.env.REQUIRE_VERIFIED_EMAIL = "false";
process.env.EMAIL_DAILY_LIMIT = "100";
process.env.REALTIME_URL = "";
process.env.REALTIME_SECRET = "";
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.VAPID_SUBJECT = "";
// Tests write uploaded files to a throwaway folder, never into the project.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "commune-test-uploads");

// Write routes run requireActive, which looks the user up in MongoDB. These tests have no
// database, so by default every test gets an active regular user. A test that needs something
// else (an admin, a suspended user) calls mockUser(...) itself, which overrides this.
beforeEach(async () => {
  const { mockUser } = await import("./helpers.js");
  mockUser({ role: "user", banned: false });
  // Usage limits are counted in MongoDB; with no database, nothing is ever over the limit.
  // quota.test.ts replaces these with a working in-memory version.
  const { QuotaLog } = await import("../models/QuotaLog.js");
  vi.spyOn(QuotaLog, "insertMany").mockResolvedValue([] as never);
  vi.spyOn(QuotaLog, "countDocuments").mockResolvedValue(0 as never);
  vi.spyOn(QuotaLog, "deleteMany").mockResolvedValue({} as never);

  // Nobody has muted or blocked anyone, unless a test says otherwise.
  const { Block } = await import("../models/Block.js");
  const none = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "sort", "limit", "populate"]) q[m] = () => q;
    q.lean = () => Promise.resolve([]);
    return q;
  };
  vi.spyOn(Block, "find").mockImplementation((() => none()) as never);
  vi.spyOn(Block, "findOne").mockImplementation((() => ({
    select: () => ({ lean: () => Promise.resolve(null) }),
  })) as never);
  vi.spyOn(Block, "exists").mockResolvedValue(null as never);
  vi.spyOn(Block, "deleteMany").mockResolvedValue({} as never);
});
