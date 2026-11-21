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

// An unclosed "{" in one stylesheet silently breaks every rule after it, because the build joins
// all the CSS into one file. Fail the build if any stylesheet has unbalanced braces.
import { readdirSync } from "node:fs";

const stylesDir = new URL("../src/styles/", import.meta.url);
for (const file of readdirSync(stylesDir).filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(new URL(file, stylesDir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const open = (css.match(/{/g) ?? []).length;
  const close = (css.match(/}/g) ?? []).length;
  if (open !== close) {
    console.error(`\nsrc/styles/${file} has ${open} "{" but ${close} "}". Close the open block.\n`);
    process.exit(1);
  }
}
