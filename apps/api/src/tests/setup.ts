import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/commune-test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-123";
// Tests write uploaded files to a throwaway folder, never into the project.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "commune-test-uploads");
