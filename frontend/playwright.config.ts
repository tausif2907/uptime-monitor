import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests need the full stack: Postgres + Redis (docker compose), a seeded DB (demo user),
 * and the worker running so the new monitor actually gets checked.
 *   pnpm run bootstrap && pnpm dev:backend   # then, in another terminal:
 *   pnpm test:e2e
 * Playwright starts the Next.js app itself unless one is already on :3000.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Tests share one database and rate-limit store; keep them sequential for determinism.
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "pnpm start" : "pnpm dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
