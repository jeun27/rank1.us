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
    : {
        command: "pnpm build && pnpm start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        // Cloudflare's public Turnstile test keys, plus a canary secret the client-bundle check looks for.
        env: {
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
          TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
          IP_HASH_SALT: process.env.IP_HASH_SALT ?? "e2e-canary-ip-hash-salt",
          ENABLE_TEAM_WORKSPACE: "true",
        },
      },
});
