// ESLint (flat config). Catches real mistakes that TypeScript alone does not: unused code, rules of React
// hooks, stray console output. Formatting is Prettier's job, not ESLint's.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "apps/api/uploads/**",
      "apps/web/public/**", // the service worker and static files are not part of the build
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    rules: {
      // Start as warnings: they point at cleanup, they do not stop a merge.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Production logs go through the logger. console.warn and console.error stay allowed.
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
    },
  },

  // Web app: browser globals and the rules of React hooks.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Servers, shared code and scripts: Node globals.
  {
    files: [
      "apps/api/**",
      "apps/realtime/**",
      "packages/**",
      ".github/scripts/**",
      "apps/web/scripts/**",
      "apps/web/*.config.{ts,js,mjs}",
      "e2e/**",
      "playwright.config.ts",
      "*.mjs",
    ],
    languageOptions: { globals: globals.node },
  },

  // Command-line scripts and the realtime logger are meant to print.
  {
    files: [
      "apps/api/src/scripts/**",
      "apps/realtime/src/log.ts",
      ".github/scripts/**",
      "apps/web/scripts/**",
    ],
    rules: { "no-console": "off" },
  },

  // Tests may be looser.
  {
    files: ["**/tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
];
