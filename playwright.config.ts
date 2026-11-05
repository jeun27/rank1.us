import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL, extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm build && pnpm start", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
