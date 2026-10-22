import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/vercelHandler.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // The shared package ships TypeScript source, so bundle it into the API build.
  noExternal: ["@commune/shared"],
});
