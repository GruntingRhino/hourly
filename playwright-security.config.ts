import { defineConfig } from "@playwright/test";

/**
 * Security & safety API test suite.
 *
 * Run:
 *   npx playwright test --config=playwright-security.config.ts
 *
 * Requires the server running at API_BASE_URL (default: http://localhost:3001)
 * and the playwright seed already applied:
 *   cd server && npx tsx prisma/seed-playwright.ts
 */
export default defineConfig({
  testDir: "./tests/security",
  timeout: 30_000,
  workers: 1,       // serial — tests share seeded data and mutate school settings
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "security-report" }],
  ],
  use: {
    baseURL: process.env.API_BASE_URL ?? "http://localhost:3001",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
});
