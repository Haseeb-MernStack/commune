// Runs before every web build. On Vercel it fails fast, with a readable message, if
// vercel.json still points at the placeholder API address (the classic "everything builds but
// login returns 404" mistake). Locally it does nothing.
import { readFileSync } from "node:fs";

if (process.env.VERCEL) {
  const config = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
  if (config.includes("YOUR-API-NAME")) {
    console.error(
      "\nvercel.json still contains YOUR-API-NAME.\n" +
        "Replace it with your real Render service name (https://<name>.onrender.com), commit, and redeploy.\n",
    );
    process.exit(1);
  }
}
