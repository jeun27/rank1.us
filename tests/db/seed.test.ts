import { execSync } from "node:child_process";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/questions/templates";
import { getLatestRunSummary } from "@/lib/queries/runs";
import { IDS, devCompetitors, devPlaces } from "../../scripts/seed/generate";
import { IRVINE_PLACES } from "../fixtures/irvine";
import { irvineRestaurants } from "../fixtures/irvine_restaurants";
import { dbUrl, resetDb, serviceClient } from "./helpers";

let pg: Client;
const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await pg.query(sql, params)).rows as T[];
const count = async (sql: string, params: unknown[] = []) => Number((await rows<{ n: string }>(sql, params))[0].n);

const realNames = [...new Set(irvineRestaurants.map((r) => r.name.trim().toLowerCase()).filter(Boolean))];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Real CSV names found as whole words in any run-derived text (answers, brands, citations).
async function realNamesInResults() {
  const text = (
    await rows<{ t: string }>(
      `select coalesce(a.text, '') || ' ' || a.question_text_used || ' ' || coalesce(a.brands::text, '') || ' ' ||
              coalesce(string_agg(c.url || ' ' || coalesce(c.title, ''), ' '), '') as t
       from public.answers a left join public.citations c on c.answer_id = a.id group by a.id`,
    )
  )
    .map((r) => r.t)
    .join("\n")
    .toLowerCase();
  return realNames.filter((n) => new RegExp(`(^|[^a-z0-9])${escape(n)}([^a-z0-9]|$)`).test(text));
}

beforeAll(async () => {
  await resetDb();
  pg = new Client({ connectionString: dbUrl() });
  await pg.connect();
}, 300_000);

afterAll(async () => {
  await pg?.end();
});

describe("supabase/seed.sql on a fresh db reset", () => {
  it("loads every seeded table", async () => {
    const counts = Object.fromEntries(
      await Promise.all(
        ["question_templates", "local_places", "fix_rules", "domain_categories", "workspaces", "workspace_members", "businesses",
          "competitors", "questions", "runs", "answers", "citations", "fixes"].map(async (t) => [t, await count(`select count(*) n from public.${t}`)]),
      ),
    );
    expect(counts).toMatchObject({
      question_templates: 20, fix_rules: 16, domain_categories: 5, workspaces: 1, workspace_members: 1, businesses: 1,
      competitors: 5, questions: 25, runs: 2, answers: 500, fixes: 0,
    });
    expect(counts.citations).toBeGreaterThan(0);
  });

  it("question_templates match TEMPLATES verbatim", async () => {
    const db = await rows(`select short_form, long_form, slots, fixed_cuisine, fixed_city, origin, sort from public.question_templates order by sort`);
    expect(db).toEqual(TEMPLATES.map((t) => ({ ...t, slots: [...t.slots] })));
  });

  it("fix_rules: R1-R15 + H1, no A rules, only R10, R11, R14, H1 enabled", async () => {
    const r = await rows<{ key: string; enabled: boolean; unverified: string[]; grp: string; ai_lever: boolean }>(
      `select key, enabled, unverified, grp, ai_lever from public.fix_rules order by key`,
    );
    expect(r.some((x) => x.key.startsWith("A"))).toBe(false);
    expect(r.filter((x) => x.enabled).map((x) => x.key).sort()).toEqual(["H1", "R10", "R11", "R14"]);
    expect(r.filter((x) => !x.enabled).every((x) => x.unverified.length > 0)).toBe(true);
    expect(r.find((x) => x.key === "H1")).toMatchObject({ grp: "hygiene", ai_lever: false });
  });

  it("local_places: Irvine places verified, Eighteen Main as a landmark", async () => {
    expect(await count(`select count(*) n from public.local_places where city = 'Irvine' and state = 'CA' and verified`)).toBe(IRVINE_PLACES.length);
    expect(await count(`select count(*) n from public.local_places where name = 'Eighteen Main' and kind = 'landmark'`)).toBe(1);
  });

  it("Example Agency is owned by the example user and Example Ramen House has 25 active questions", async () => {
    const [ws] = await rows(`select w.name, w.seats_quantity, u.email, m.role from public.workspaces w
      join auth.users u on u.id = w.owner_id join public.workspace_members m on m.workspace_id = w.id and m.user_id = u.id`);
    expect(ws).toEqual({ name: "Example Agency", seats_quantity: 1, email: "owner@example.test", role: "owner" });
    expect(await count(`select count(*) n from public.questions where business_id = $1 and active and city = 'Irvine' and state = 'CA' and country = 'US'`, [IDS.business])).toBe(25);
  });

  it("every brand name starts with Example", async () => {
    const names = await rows<{ name: string }>(`
      select name from public.businesses union select name from public.competitors
      union select b->>'name' from public.answers, jsonb_array_elements(coalesce(brands, '[]')) b`);
    expect(names.filter((n) => !n.name.startsWith("Example"))).toEqual([]);
  });

  it("run jobs counts match the answer rows", async () => {
    const r = await rows(`select r.jobs_total, r.jobs_ok, r.jobs_failed,
        count(a.*)::int answers,
        (count(*) filter (where a.status in ('ok', 'no_overview')))::int ok_or_no_overview,
        (count(*) filter (where a.status = 'failed'))::int failed
      from public.runs r join public.answers a on a.run_id = r.id group by r.id order by r.started_at`);
    expect(r).toEqual([
      { jobs_total: 250, jobs_ok: 241, jobs_failed: 9, answers: 250, ok_or_no_overview: 241, failed: 9 },
      { jobs_total: 250, jobs_ok: 245, jobs_failed: 5, answers: 250, ok_or_no_overview: 245, failed: 5 },
    ]);
  });

  it("visibility excludes failed and no_overview answers from the denominator", async () => {
    const summary = (await getLatestRunSummary(serviceClient(), IDS.business))!;
    const [exp] = await rows<{ ok: number; named: number; excluded: number }>(`
      select (count(*) filter (where status = 'ok'))::int ok, (count(*) filter (where status = 'ok' and mentioned))::int named,
             (count(*) filter (where status in ('failed', 'no_overview')))::int excluded
      from public.answers where run_id = $1`, [summary.id]);
    expect(exp.excluded).toBe(17);
    expect(summary.visibility).toEqual({ value: exp.named / exp.ok, numerator: exp.named, denominator: exp.ok });
    expect(summary.visibility.denominator).toBe(250 - 17);
  });

  it("location_supported: fallback_country for chatgpt and gemini, exact for google_aio and perplexity", async () => {
    const r = await rows(`select engine, array_agg(distinct location_supported) s from public.answers group by engine order by engine`);
    expect(r).toEqual([
      { engine: "chatgpt", s: ["fallback_country"] },
      { engine: "gemini", s: ["fallback_country"] },
      { engine: "google_aio", s: ["exact"] },
      { engine: "perplexity", s: ["exact"] },
    ]);
  });

  it("citations use fake .test domains with a known category", async () => {
    expect(await count(`select count(*) n from public.citations c left join public.domain_categories d using (domain)
      where c.domain not like 'example-%.test' or d.category is distinct from c.category`)).toBe(0);
  });

  it("no real CSV restaurant name appears in runs, answers or citations", async () => {
    expect(await realNamesInResults()).toEqual([]);
  });
});

describe("supabase/seed.dev.sql", () => {
  beforeAll(() => {
    execSync("pnpm db:seed:dev", { stdio: "pipe" });
    execSync("pnpm db:seed:dev", { stdio: "pipe" }); // re-runnable
  }, 60_000);

  it("adds the CSV restaurants as hidden suggested competitors and clusters as unverified landmarks", async () => {
    expect(await count(`select count(*) n from public.competitors where business_id = $1 and source = 'suggested' and hidden`, [IDS.business])).toBe(devCompetitors().length);
    expect(await count(`select count(*) n from public.competitors where source = 'suggested' and not hidden`)).toBe(0);
    expect(await count(`select count(*) n from public.local_places where not verified and kind = 'landmark'`)).toBe(devPlaces().length);
    expect(await count(`select count(*) n from public.local_places where verified`)).toBe(IRVINE_PLACES.length);
  });

  it("creates zero runs, answers, citations or fixes for real names", async () => {
    expect(await count(`select count(*) n from public.runs`)).toBe(2);
    expect(await count(`select count(*) n from public.answers`)).toBe(500);
    expect(await count(`select count(*) n from public.fixes`)).toBe(0);
    expect(await realNamesInResults()).toEqual([]);
  });
});
