// Runs before every web build. On Vercel it fails fast, with a readable message, if
// vercel.json still points at the placeholder API address (the classic "everything builds but
// login returns 404" mistake). Locally it does nothing.
import { readFileSync } from "node:fs";

// Set ALLOW_PLACEHOLDER_API=1 in Vercel to deploy the frontend before the API exists.
if (process.env.VERCEL && !process.env.ALLOW_PLACEHOLDER_API) {
  const config = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
  if (config.includes("YOUR-API-NAME")) {
    console.error(
      "\nvercel.json still contains YOUR-API-NAME.\n" +
        "Replace it with your real Render service name (https://<name>.onrender.com), commit, and redeploy.\n",
    );
    process.exit(1);
  }
}
