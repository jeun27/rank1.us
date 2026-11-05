import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// DB tests run against the local Supabase stack (`pnpm exec supabase start`).
// Keys come from `supabase status`, never from committed files.
function localSupabaseEnv(): Record<string, string> {
  const out = execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[`SUPABASE_LOCAL_${m[1]}`] = m[2];
  }
  return env;
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    env: localSupabaseEnv(),
    // Files share one database and one of them resets it, so run them one at a time.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
