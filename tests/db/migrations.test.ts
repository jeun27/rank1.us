import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, PUBLIC_TABLES, resetDb, waitForSchema } from "./helpers";

const TABLES = [...PUBLIC_TABLES].sort();

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

beforeAll(async () => {
  await resetDb();
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
    await waitForSchema();
    const tables = await publicTables();
    expect(tables.map((t) => t.name)).toEqual(TABLES);
    expect(tables.filter((t) => !t.rls)).toEqual([]);
  }, 90_000);
});
