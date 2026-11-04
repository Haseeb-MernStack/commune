import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Only types are imported from the shared package, but bundle it in case that ever changes.
  noExternal: ["@commune/shared"],
});
