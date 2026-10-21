import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Resolve the shared package straight from its TypeScript source instead of relying on the
// node_modules link or a build step, so a clean checkout (Vercel, CI) builds without extras.
// decodeURIComponent and the drive-letter fix keep this working for Windows paths with spaces.
const sharedEntry = decodeURIComponent(
  new URL("../../packages/shared/src/index.ts", import.meta.url).pathname,
).replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@commune/shared": sharedEntry } },
  server: { port: 5173 },
});
