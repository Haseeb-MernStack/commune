import { defineConfig, devices } from "@playwright/test";

const WEB = "http://localhost:5173";
const API = "http://localhost:4000";

// Browser tests run against a real API and a separate "commune_e2e" database, so they never touch your
// development data. They need MongoDB: locally `docker compose up -d mongo`, in CI a service container.
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -w @commune/api",
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        PORT: "4000",
        MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017/commune_e2e",
        CLIENT_ORIGIN: WEB,
        // A throwaway value for tests only. Never use it anywhere real.
        JWT_ACCESS_SECRET:
          process.env.JWT_ACCESS_SECRET ?? "e2e-only-secret-not-for-real-use-0123456789",
      },
    },
    {
      command: "npm run dev -w @commune/web",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: `${API}/api` },
    },
  ],
});
