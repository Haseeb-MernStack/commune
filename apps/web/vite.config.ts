import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Resolve the shared package straight from its TypeScript source instead of relying on the
// node_modules link or a build step, so a clean checkout (Vercel, CI) builds without extras.
// decodeURIComponent and the drive-letter fix keep this working for Windows paths with spaces.
const sharedEntry = decodeURIComponent(
  new URL("../../packages/shared/src/index.ts", import.meta.url).pathname,
).replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: { "@commune/shared": sharedEntry } },
  server: { port: 5173 },
  // Production bundles contain no console calls or debugger statements, so nothing can leak
  // through the browser console even if one is added by mistake.
  esbuild: mode === "production" ? { drop: ["console", "debugger"] } : {},
  build: {
    target: "es2020",
    sourcemap: false,
    // Long-lived libraries go in their own files so they stay cached between deployments
    // while only the (small, changing) app code is downloaded again.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));
