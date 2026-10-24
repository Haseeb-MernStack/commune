// Vercel insists the "public" output directory is non-empty, even for a pure API project.
// This writes a tiny landing page there; every other path is served by the API function.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("public", { recursive: true });
writeFileSync(
  "public/index.html",
  "<!doctype html><meta charset=utf-8><title>Commune API</title><p>Commune API is running. Health check: <a href=/api/health>/api/health</a></p>\n",
);
