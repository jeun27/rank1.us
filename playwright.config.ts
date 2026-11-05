import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// Local builds talk to the local Supabase stack. Keys come from `supabase status`, never from committed files.
function localSupabase(): Record<string, string> {
  if (process.env.E2E_BASE_URL) return {};
  const out = execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env: Record<string, string> = {};
  for (const m of out.matchAll(/^([A-Z_]+)="?(.*?)"?$/gm)) env[`SUPABASE_LOCAL_${m[1]}`] = m[2];
  // Also as the server name, so client-secrets.spec.ts greps the bundle for the real service-role value.
  Object.assign(process.env, env, { SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_LOCAL_SERVICE_ROLE_KEY });
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_LOCAL_API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_LOCAL_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_LOCAL_SERVICE_ROLE_KEY,
  };
}
const supabaseEnv = localSupabase();

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
          ...supabaseEnv,
        },
      },
});
