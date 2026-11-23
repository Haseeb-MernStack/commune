import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same JSX setting as tsconfig ("react-jsx"), without needing the React plugin.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@commune/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
