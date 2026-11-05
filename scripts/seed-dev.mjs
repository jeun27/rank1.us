// Applies supabase/seed.dev.sql to the LOCAL Supabase database only. Dev-only: never point this at production.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const env = execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const url = env.match(/^DB_URL="?(.*?)"?$/m)?.[1];
if (!url || !/@(127\.0\.0\.1|localhost):/.test(url))
  throw new Error(`Refusing to seed: not a local database (${url ?? "no DB_URL"})`);

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(readFileSync("supabase/seed.dev.sql", "utf8"));
await client.end();
console.log("Applied supabase/seed.dev.sql to the local database");
