import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiUrl, dbUrl } from "./helpers";

const TABLES = [
  "workspaces",
  "workspace_members",
  "businesses",
  "competitors",
  "questions",
  "runs",
  "answers",
  "citations",
  "domain_categories",
  "fix_rules",
  "question_templates",
  "local_places",
  "listing_snapshots",
  "fixes",
  "experiments",
  "experiment_questions",
  "google_tokens",
  "ai_traffic",
  "reports",
  "leads",
  "contact_requests",
  "stripe_events",
  "user_roles",
  "rate_events",
  "onboarding_lookups",
].sort();

const dir = (sub: string) => join(process.cwd(), "supabase", sub);
const sqlFiles = (sub: string) =>
  readdirSync(dir(sub))
    .filter((f) => f.endsWith(".sql"))
    .sort();

let pg: Client;

async function publicTables() {
  const { rows } = await pg.query<{ name: string; rls: boolean }>(
    `select c.relname as name, c.relrowsecurity as rls from pg_class c
     join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  return rows;
}

// db reset restarts the API containers; wait until auth and PostgREST answer again.
async function waitForApi() {
  for (let i = 0; i < 60; i++) {
    try {
      const [auth, rest] = await Promise.all([fetch(`${apiUrl()}/auth/v1/health`), fetch(`${apiUrl()}/rest/v1/`)]);
      if (auth.status < 500 && rest.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Supabase API did not come back after db reset");
}

beforeAll(async () => {
  execSync("pnpm exec supabase db reset", { stdio: "pipe" });
  await waitForApi();
  pg = new Client({ connectionString: dbUrl() });
  await pg.connect();
}, 300_000);

afterAll(async () => {
  await pg?.end();
});

describe("migrations", () => {
  it("supabase db reset applies every migration on a fresh database", async () => {
    const tables = await publicTables();
    expect(tables.map((t) => t.name)).toEqual(TABLES);
    expect(tables.filter((t) => !t.rls)).toEqual([]);
  });

  it("every migration has a rollback", () => {
    expect(sqlFiles("rollbacks")).toEqual(sqlFiles("migrations").map((f) => f.replace(/\.sql$/, ".down.sql")));
  });

  it("rollbacks undo everything in reverse order, and the migrations re-apply after", async () => {
    for (const f of sqlFiles("rollbacks").reverse()) await pg.query(readFileSync(join(dir("rollbacks"), f), "utf8"));
    expect(await publicTables()).toEqual([]);
    const { rows } = await pg.query("select 1 from pg_namespace where nspname = 'private'");
    expect(rows).toEqual([]);

    for (const f of sqlFiles("migrations")) await pg.query(readFileSync(join(dir("migrations"), f), "utf8"));
    await pg.query("notify pgrst, 'reload schema'");
    const tables = await publicTables();
    expect(tables.map((t) => t.name)).toEqual(TABLES);
    expect(tables.filter((t) => !t.rls)).toEqual([]);
  });
});
