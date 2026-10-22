import os from "node:os";
import path from "node:path";
import { beforeEach } from "vitest";

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
process.env.REQUIRE_VERIFIED_EMAIL = "false";
// Tests write uploaded files to a throwaway folder, never into the project.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "commune-test-uploads");

// Write routes run requireActive, which looks the user up in MongoDB. These tests have no
// database, so by default every test gets an active regular user. A test that needs something
// else (an admin, a suspended user) calls mockUser(...) itself, which overrides this.
beforeEach(async () => {
  const { mockUser } = await import("./helpers.js");
  mockUser({ role: "user", banned: false });
});