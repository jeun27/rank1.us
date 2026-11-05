import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// Build grep: no server-only name or value reaches the browser bundle (.next/static).
// The e2e build sets canary values (playwright.config.ts) so the value check is real.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "IP_HASH_SALT",
  "CONTACT_TO_EMAIL",
  "CONTACT_FROM_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "DATAFORSEO_PASSWORD",
  "PERPLEXITY_API_KEY",
  "CRON_SECRET",
];
const CANARIES = ["1x0000000000000000000000000000000AA", "e2e-canary-ip-hash-salt"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test("client bundles hold no server-only env names or secret values", async ({}, info) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "checks the local build output");
  test.skip(info.project.name !== "desktop", "one run is enough");
  const bundle = files(".next/static")
    .filter((f) => /\.(js|css|html|json)$/.test(f))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  expect(bundle.length).toBeGreaterThan(1000);
  expect(bundle).toContain("1x00000000000000000000AA"); // the public site key does reach the browser
  const values = SERVER_ONLY.map((n) => process.env[n]).filter((v): v is string => Boolean(v && v.length >= 8));
  for (const s of [...SERVER_ONLY, ...CANARIES, ...values]) expect(bundle.includes(s), s.slice(0, 4) + "…").toBe(false);
});
