// Prints the CSP hash of every inline <script> in index.html. Use it when you are ready to drop
// 'unsafe-inline' from script-src: add each printed value ('sha256-...') to the policy instead.
// Any edit to an inline script changes its hash, so run this again after editing index.html.
//
//   node apps/web/scripts/csp-hashes.mjs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];

if (scripts.length === 0) console.log("No inline scripts found.");
scripts.forEach((m, i) => {
  const hash = createHash("sha256").update(m[1]).digest("base64");
  const first = m[1].trim().split("\n")[0]?.trim().slice(0, 70);
  console.log(`'sha256-${hash}'  // inline script ${i + 1}: ${first}`);
});
