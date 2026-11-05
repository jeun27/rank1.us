import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/questions/templates";
import {
  BUSINESS,
  COMPETITORS,
  RUNS_PER_ENGINE,
  devCompetitors,
  devSeedSql,
  seedData,
  seedSql,
} from "../../scripts/seed/generate";
import { irvineRestaurants } from "../fixtures/irvine_restaurants";

const path = (f: string) => join(process.cwd(), "supabase", f);
const data = seedData();

// `pnpm db:seed:gen` sets WRITE_SEED=1 to regenerate; otherwise the committed files must match the generator.
if (process.env.WRITE_SEED === "1") {
  writeFileSync(path("seed.sql"), seedSql(data));
  writeFileSync(path("seed.dev.sql"), devSeedSql());
}
const seed = readFileSync(path("seed.sql"), "utf8");
const dev = readFileSync(path("seed.dev.sql"), "utf8");

// Values of one table's insert, as parsed SQL literals ('' unescaped). Good enough for our generated SQL.
function tuples(sql: string, table: string): string[][] {
  const block = sql.split(`insert into public.${table} `)[1]?.split(";\n")[0];
  if (!block) return [];
  return block
    .split("\n")
    .slice(1)
    .map((line) =>
      [...line.matchAll(/'((?:[^']|'')*)'|(\bnull\b|\btrue\b|\bfalse\b|-?\d+(?:\.\d+)?)/g)].map((m) =>
        (m[1] ?? m[2]).replace(/''/g, "'"),
      ),
    );
}

describe("supabase/seed.sql", () => {
  it("is reproducible from scripts/seed/generate.ts", () => {
    expect(seed).toBe(seedSql(seedData()));
    expect(dev).toBe(devSeedSql());
  });

  it("question_templates match TEMPLATES verbatim", () => {
    const rows = tuples(seed, "question_templates");
    expect(rows.map(([, , short_form, long_form]) => ({ short_form, long_form }))).toEqual(
      TEMPLATES.map((t) => ({ short_form: t.short_form, long_form: t.long_form })),
    );
    expect(rows.map((r) => r.slice(-4))).toEqual(
      TEMPLATES.map((t) => [t.fixed_cuisine ?? "null", t.fixed_city ?? "null", t.origin, String(t.sort)]),
    );
  });

  it("seeds R1-R15 and H1 only, with customer copy from SCHEMA.md 5b", () => {
    expect(data.rules.map((r) => r.key)).toEqual([...Array.from({ length: 15 }, (_, i) => `R${i + 1}`), "H1"]);
    expect(seed).not.toMatch(/'A[1-6]'/);
    const schema = readFileSync(join(process.cwd(), "docs", "SCHEMA.md"), "utf8");
    for (const r of data.rules) expect(schema).toContain(r.customer_copy.replace(/\|/g, "\\|"));
    const h1 = data.rules.find((r) => r.key === "H1")!;
    expect(h1).toMatchObject({ grp: "hygiene", ai_lever: false });
  });

  it("every rule that mentions UNVERIFIED is disabled and lists it", () => {
    for (const r of data.rules) {
      if (/UNVERIFIED/.test(`${r.detection} ${r.data_source}`)) expect(r.unverified.length, r.key).toBeGreaterThan(0);
      expect(r.enabled, r.key).toBe(r.unverified.length === 0);
    }
    expect(data.rules.filter((r) => r.enabled).map((r) => r.key)).toEqual(["R10", "R11", "R14", "H1"]);
  });

  it("every seeded brand name starts with Example", () => {
    const names = [
      ...tuples(seed, "businesses").map((r) => r[2]),
      ...tuples(seed, "competitors").map((r) => r[2]),
      tuples(seed, "workspaces")[0][1],
      ...data.answers.flatMap((a) => (a.brands ?? []).map((b) => b.name)),
    ];
    expect(names.length).toBeGreaterThan(7);
    expect(names.filter((n) => !n.startsWith("Example"))).toEqual([]);
  });

  it("Example Ramen House has 25 active questions", () => {
    const qs = tuples(seed, "questions");
    expect(qs).toHaveLength(25);
    expect(qs.every((q) => q[5] === "true" && q[9] === "Irvine")).toBe(true);
  });

  it("each run has 25 questions x 10 answers with the engine mix", () => {
    for (const run of data.runs) {
      const as = data.answers.filter((a) => a.run_id === run.id);
      expect(as).toHaveLength(250);
      for (const [engine, n] of Object.entries(RUNS_PER_ENGINE))
        expect(as.filter((a) => a.engine === engine)).toHaveLength(25 * n);
    }
  });

  it("jobs counts match the answer rows: ok = ok + no_overview, failed = failed", () => {
    for (const run of data.runs) {
      const as = data.answers.filter((a) => a.run_id === run.id);
      const count = (s: string) => as.filter((a) => a.status === s).length;
      expect(run.jobs_ok).toBe(count("ok") + count("no_overview"));
      expect(run.jobs_failed).toBe(count("failed"));
      expect(run.jobs_total).toBe(as.length);
      expect(run.jobs_total).toBe(run.jobs_ok + run.jobs_failed);
    }
    expect(data.runs.map((r) => [r.jobs_ok, r.jobs_failed])).toEqual([
      [241, 9],
      [245, 5],
    ]);
  });

  it("failed and no_overview answers carry no mention data; no_overview is Google AI Overview only", () => {
    const notOk = data.answers.filter((a) => a.status !== "ok");
    expect(notOk.filter((a) => a.status === "no_overview").every((a) => a.engine === "google_aio")).toBe(true);
    expect(notOk.every((a) => a.mentioned === null && a.brands === null && a.first_position === null)).toBe(true);
  });

  it("visibility rises from week 1 to week 2 over ok answers only", () => {
    const vis = data.runs.map((run) => {
      const ok = data.answers.filter((a) => a.run_id === run.id && a.status === "ok");
      return ok.filter((a) => a.mentioned).length / ok.length;
    });
    expect(vis[1]).toBeGreaterThan(vis[0]);
    // Floors to 24% then 30%: +6 pts, as on the /dev/ui leaderboard.
    expect(vis.map((v) => Math.floor(v * 100))).toEqual([24, 30]);
  });

  it("first_position points at Example Ramen House in brands", () => {
    for (const a of data.answers.filter((x) => x.mentioned))
      expect(a.brands![a.first_position! - 1].name).toBe(BUSINESS);
  });

  it("citations use only fake .test domains", () => {
    const urls = tuples(seed, "citations").map((r) => r[2]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !/^https:\/\/example-[a-z]+\.test\//.test(u))).toEqual([]);
    // The only other URL is the OpenAI bots doc quoted verbatim in R14's data_source.
    const other = [...seed.matchAll(/https?:\/\/[^\s'")]+/g)]
      .map((m) => m[0])
      .filter((u) => !/^https:\/\/example-[a-z]+\.test\//.test(u));
    expect([...new Set(other)]).toEqual(["https://platform.openai.com/docs/bots"]);
  });

  it("no real CSV restaurant name appears in seed.sql", () => {
    const text = seed.toLowerCase();
    const word = (n: string) =>
      new RegExp(`(^|[^a-z0-9])${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    const hits = irvineRestaurants.map((r) => r.name.trim()).filter((n) => n && word(n).test(text));
    expect(hits).toEqual([]);
  });

  it("has no rating anywhere in the example data", () => {
    expect(dev).not.toMatch(/rating|review/i);
    expect(seed).not.toMatch(/insert into public\.competitors \([^)]*rating/);
  });
});

describe("supabase/seed.dev.sql", () => {
  it("is marked dev-only and is not in config.toml seed paths", () => {
    expect(dev.split("\n")[0]).toMatch(/^-- DEV ONLY\. Never run in production\./);
    const config = readFileSync(path("config.toml"), "utf8");
    expect(config).toMatch(/sql_paths = \["\.\/seed\.sql"\]/);
    expect(config).not.toContain("seed.dev.sql");
  });

  it("adds hidden suggested competitors, ramen/Japanese first, and never runs or answers", () => {
    const rows = tuples(dev, "competitors");
    expect(rows.length).toBe(devCompetitors().length);
    expect(rows.every((r) => r[3] === "suggested" && r[4] === "true")).toBe(true);
    const all = devCompetitors();
    const japanese = all.filter((c) => c.japanese).length;
    expect(japanese).toBeGreaterThan(0);
    expect(all.slice(0, japanese).every((c) => c.japanese)).toBe(true);
    expect(all.slice(japanese).some((c) => c.japanese)).toBe(false);
    expect(dev).not.toMatch(/insert into public\.(runs|answers|citations|fixes|experiments|reports|ai_traffic)/);
  });

  it("skips permanently closed restaurants", () => {
    const closed = irvineRestaurants.filter((r) => r.google_status === "permanently closed").map((r) => r.name.trim());
    const open = new Set(
      irvineRestaurants.filter((r) => r.google_status !== "permanently closed").map((r) => r.name.trim().toLowerCase()),
    );
    const names = new Set(devCompetitors().map((c) => c.name.toLowerCase()));
    expect(closed.filter((n) => names.has(n.toLowerCase()) && !open.has(n.toLowerCase()))).toEqual([]);
  });

  it("names only competitors, never the Example brands", () => {
    expect(devCompetitors().some((c) => COMPETITORS.includes(c.name) || c.name === BUSINESS)).toBe(false);
  });
});
