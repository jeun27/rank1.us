// Builds supabase/seed.sql and supabase/seed.dev.sql. Deterministic: fixed RNG seed, ids hashed from labels.
// Regenerate with `pnpm db:seed:gen`; tests/unit/seed.test.ts fails if the committed files drift.
import { createHash } from "node:crypto";
import { TEMPLATES } from "@/lib/questions/templates";
import { IRVINE_PLACES } from "../../tests/fixtures/irvine";
import { exampleRamenHouseQuestions } from "../../tests/fixtures/example-ramen-house";
import { irvineRestaurants, type IrvineRestaurant } from "../../tests/fixtures/irvine_restaurants";
import { fixRules } from "./fix-rules";

export const ENGINES = ["chatgpt", "gemini", "google_aio", "perplexity"] as const;
export type Engine = (typeof ENGINES)[number];
export const RUNS_PER_ENGINE: Record<Engine, number> = { chatgpt: 3, gemini: 3, google_aio: 3, perplexity: 1 };

export const BUSINESS = "Example Ramen House";
export const COMPETITORS = ["Example Noodle Bar", "Example Izakaya", "Example Tonkotsu Co.", "Example Udon House", "Example Pho Spot"];

// Per week: share of ok answers naming Example Ramen House, and how many answers fail or have no overview.
export const WEEKS = [
  {
    started_at: "2026-10-26T14:00:00Z",
    rate: { chatgpt: 0.23, gemini: 0.18, google_aio: 0.33, perplexity: 0.24 },
    failed: { chatgpt: 4, gemini: 3, google_aio: 0, perplexity: 2 },
    no_overview: 14,
  },
  {
    started_at: "2026-11-02T14:00:00Z",
    rate: { chatgpt: 0.27, gemini: 0.23, google_aio: 0.4, perplexity: 0.32 },
    failed: { chatgpt: 2, gemini: 2, google_aio: 0, perplexity: 1 },
    no_overview: 12,
  },
] as const;

// Clearly fake domains only (.test is reserved). Category from the domain_categories enum.
export const CITATION_DOMAINS = [
  { domain: "example-reviews.test", category: "review_directory" },
  { domain: "example-blog.test", category: "news_blog" },
  { domain: "example-localnews.test", category: "news_blog" },
  { domain: "example-social.test", category: "social" },
  { domain: "example-guide.test", category: "other" },
] as const;

export const OWNER_EMAIL = "owner@example.test";

// Stable uuid from a label, so seed.dev.sql and tests can reference seed rows.
export const id = (label: string) => {
  const h = createHash("sha1").update(`rank1-seed:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const IDS = { owner: id("owner"), workspace: id("workspace"), business: id("business") };

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffled = <T>(xs: readonly T[], rand: () => number) => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const lit = (v: string | number | boolean | null): string =>
  v === null ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v);
const arr = (xs: readonly string[]) => (xs.length ? `array[${xs.map(lit).join(", ")}]` : "'{}'::text[]");
const json = (v: unknown) => (v === null ? "null" : `${lit(JSON.stringify(v))}::jsonb`);

function insert(table: string, rows: Record<string, string>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return `insert into public.${table} (${cols.join(", ")}) values\n${rows.map((r) => `  (${cols.map((c) => r[c]).join(", ")})`).join(",\n")};\n`;
}

const addMinutes = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60_000).toISOString();

export type AnswerSeed = {
  id: string;
  run_id: string;
  question_id: string;
  engine: Engine;
  run_index: number;
  status: "ok" | "failed" | "no_overview";
  mentioned: boolean | null;
  first_position: number | null;
  brands: { name: string; position: number }[] | null;
  checked_at: string;
};

export type SeedData = ReturnType<typeof seedData>;

export function seedData() {
  const rand = mulberry32(1);
  const questions = exampleRamenHouseQuestions.map((q, i) => ({ ...q, id: id(`question:${i + 1}`) }));
  const runs: { id: string; started_at: string; finished_at: string; jobs_total: number; jobs_ok: number; jobs_failed: number }[] = [];
  const answers: AnswerSeed[] = [];
  const citations: { id: string; answer_id: string; url: string; domain: string; title: string; position: number; category: string }[] = [];

  WEEKS.forEach((week, w) => {
    const runId = id(`run:${w + 1}`);
    const runAnswers: AnswerSeed[] = [];
    for (const engine of ENGINES) {
      const slots = questions.flatMap((q, qi) =>
        Array.from({ length: RUNS_PER_ENGINE[engine] }, (_, r) => ({ q, qi, run_index: r + 1 })),
      );
      const order = shuffled(slots, rand);
      const notOk = engine === "google_aio" ? week.no_overview : week.failed[engine];
      const okSlots = order.slice(notOk);
      const okSet = new Set(okSlots);
      const named = new Set(okSlots.slice(0, Math.round(week.rate[engine] * okSlots.length)));
      for (const s of slots) {
        const status = !okSet.has(s) ? (engine === "google_aio" ? "no_overview" : "failed") : "ok";
        const mentioned = status === "ok" ? named.has(s) : null;
        let brands: AnswerSeed["brands"] = null;
        if (status === "ok") {
          const names = shuffled(COMPETITORS, rand).slice(0, 2 + Math.floor(rand() * 3));
          if (mentioned) names.splice(Math.floor(rand() * Math.min(3, names.length + 1)), 0, BUSINESS);
          brands = names.map((name, i) => ({ name, position: i + 1 }));
        }
        const a: AnswerSeed = {
          id: id(`answer:${w + 1}:${engine}:${s.qi + 1}:${s.run_index}`),
          run_id: runId,
          question_id: s.q.id,
          engine,
          run_index: s.run_index,
          status,
          mentioned,
          first_position: mentioned ? brands!.find((b) => b.name === BUSINESS)!.position : null,
          brands,
          checked_at: addMinutes(week.started_at, 1 + s.qi),
        };
        runAnswers.push(a);
        if (status === "ok") {
          const n = Math.floor(rand() * 4);
          shuffled(CITATION_DOMAINS, rand)
            .slice(0, n)
            .forEach((d, i) =>
              citations.push({
                id: id(`citation:${a.id}:${i + 1}`),
                answer_id: a.id,
                url: `https://${d.domain}/irvine/ramen/week-${w + 1}-${s.qi + 1}-${engine}-${s.run_index}`,
                domain: d.domain,
                title: `Example data: ${s.q.short_text}`,
                position: i + 1,
                category: d.category,
              }),
            );
        }
      }
    }
    const failed = runAnswers.filter((a) => a.status === "failed").length;
    runs.push({
      id: runId,
      started_at: week.started_at,
      finished_at: addMinutes(week.started_at, 40),
      jobs_total: runAnswers.length,
      jobs_ok: runAnswers.length - failed,
      jobs_failed: failed,
    });
    answers.push(...runAnswers);
  });

  return { questions, runs, answers, citations, rules: fixRules() };
}

const questionText = (q: SeedData["questions"][number]) => q.short_text;

function answerText(a: AnswerSeed, q: string) {
  if (a.status !== "ok") return null;
  return `Example data. Picks for "${q}": ${a.brands!.map((b) => b.name).join(", ")}`;
}

export function seedSql(data: SeedData = seedData()): string {
  const { questions, runs, answers, citations, rules } = data;
  const qById = new Map(questions.map((q) => [q.id, q]));
  const parts = [
    "-- Rank1 seed: reference data + Example data. Runs on every `supabase db reset` (config.toml [db.seed]).",
    "-- Generated by scripts/seed/generate.ts (`pnpm db:seed:gen`). Do not edit by hand.",
    "-- Brand names are invented and start with \"Example\". No real restaurants, no ratings.",
    "",
    "-- Reference data",
    insert(
      "question_templates",
      TEMPLATES.map((t) => ({
        id: lit(id(`template:${t.sort}`)),
        vertical: lit("restaurant"),
        short_form: lit(t.short_form),
        long_form: lit(t.long_form),
        slots: arr(t.slots),
        fixed_cuisine: lit(t.fixed_cuisine),
        fixed_city: lit(t.fixed_city),
        origin: lit(t.origin),
        sort: lit(t.sort),
      })),
    ),
    insert(
      "local_places",
      IRVINE_PLACES.map((p) => ({
        id: lit(id(`place:${p.name}`)),
        city: lit("Irvine"),
        state: lit("CA"),
        name: lit(p.name),
        kind: lit(p.kind),
        verified: "true",
      })),
    ),
    insert(
      "fix_rules",
      rules.map((r) => ({
        key: lit(r.key),
        grp: lit(r.grp),
        title: lit(r.title),
        size: lit(r.size),
        detection: lit(r.detection),
        data_source: lit(r.data_source),
        cadence: lit(r.cadence),
        threshold: json(r.threshold),
        unverified: arr(r.unverified),
        customer_copy: lit(r.customer_copy),
        why_note: lit(r.why_note),
        ai_lever: lit(r.ai_lever),
        enabled: lit(r.enabled),
      })),
    ),
    insert(
      "domain_categories",
      CITATION_DOMAINS.map((d) => ({ domain: lit(d.domain), category: lit(d.category), source: lit("manual") })),
    ),
    "-- Example data",
    "-- Owner: an example auth user with no password (cannot sign in). The workspace trigger adds the owner member row.",
    `insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${lit(IDS.owner)}, 'authenticated', 'authenticated', ${lit(OWNER_EMAIL)}, '2026-10-01T00:00:00Z', '{"provider":"email","providers":["email"]}', '{}', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', '', '', '', '');\n`,
    "-- seats_quantity is set on insert: the seats trigger blocks business inserts while it is 0.",
    insert("workspaces", [
      { id: lit(IDS.workspace), name: lit("Example Agency"), owner_id: lit(IDS.owner), seats_quantity: "1" },
    ]),
    insert("businesses", [
      {
        id: lit(IDS.business),
        workspace_id: lit(IDS.workspace),
        name: lit(BUSINESS),
        vertical: lit("restaurant"),
        cuisine: lit("ramen"),
        city: lit("Irvine"),
        state: lit("CA"),
        country: lit("US"),
      },
    ]),
    insert(
      "competitors",
      COMPETITORS.map((name) => ({
        id: lit(id(`competitor:${name}`)),
        business_id: lit(IDS.business),
        name: lit(name),
        source: lit("manual"),
        hidden: "false",
      })),
    ),
    insert(
      "questions",
      questions.map((q) => ({
        id: lit(q.id),
        business_id: lit(IDS.business),
        short_text: lit(q.short_text),
        long_text: lit(q.long_text),
        active_form: lit("short"),
        active: "true",
        location_level: lit("city"),
        country: lit("US"),
        state: lit("CA"),
        city: lit("Irvine"),
        template_key: lit(String(q.template_sort)),
      })),
    ),
    insert(
      "runs",
      runs.map((r) => ({
        id: lit(r.id),
        business_id: lit(IDS.business),
        kind: lit("weekly"),
        status: lit(r.jobs_failed ? "partial" : "complete"),
        jobs_total: lit(r.jobs_total),
        jobs_ok: lit(r.jobs_ok),
        jobs_failed: lit(r.jobs_failed),
        started_at: lit(r.started_at),
        finished_at: lit(r.finished_at),
      })),
    ),
    insert(
      "answers",
      answers.map((a) => {
        const q = questionText(qById.get(a.question_id)!);
        const exact = a.engine === "google_aio" || a.engine === "perplexity";
        return {
          id: lit(a.id),
          run_id: lit(a.run_id),
          question_id: lit(a.question_id),
          engine: lit(a.engine),
          run_index: lit(a.run_index),
          status: lit(a.status),
          text: lit(answerText(a, q)),
          question_text_used: lit(q),
          location_used: lit(exact ? "Irvine, CA, US" : "US"),
          location_supported: lit(exact ? "exact" : "fallback_country"),
          mentioned: lit(a.mentioned),
          first_position: lit(a.first_position),
          brands: json(a.brands),
          raw: json({ example_data: true }),
          checked_at: lit(a.checked_at),
        };
      }),
    ),
    insert(
      "citations",
      citations.map((c) => ({
        id: lit(c.id),
        answer_id: lit(c.answer_id),
        url: lit(c.url),
        domain: lit(c.domain),
        title: lit(c.title),
        position: lit(c.position),
        category: lit(c.category),
      })),
    ),
  ];
  return parts.filter((p) => p !== "").join("\n");
}

const JAPANESE = /ramen|japanese|sushi|izakaya|udon|soba|tonkatsu|yakitori/i;
const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

// Real Irvine names, deduped by name (case-insensitive), closed rows skipped, ramen/Japanese first.
export function devCompetitors(rows: IrvineRestaurant[] = irvineRestaurants) {
  const seen = new Set<string>();
  const open = rows.filter((r) => r.google_status !== "permanently closed" && r.name.trim());
  const unique = open.filter((r) => {
    const k = r.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const japanese = (r: IrvineRestaurant) => JAPANESE.test(`${r.name} ${r.cuisine}`);
  return [...unique.filter(japanese), ...unique.filter((r) => !japanese(r))].map((r) => ({
    name: r.name.trim(),
    domain: hostOf(r.website || r.enr_website),
    japanese: japanese(r),
  }));
}

export function devPlaces(rows: IrvineRestaurant[] = irvineRestaurants) {
  const known = new Set(IRVINE_PLACES.map((p) => p.name.toLowerCase()));
  return [...new Set(rows.filter((r) => r.google_status !== "permanently closed").map((r) => r.cluster.trim()))]
    .filter((c) => c && !known.has(c.toLowerCase()))
    .sort();
}

export function devSeedSql(): string {
  const competitors = devCompetitors();
  const places = devPlaces();
  return [
    "-- DEV ONLY. Never run in production. Not listed in supabase/config.toml [db.seed].",
    "-- Apply locally with `pnpm db:seed:dev` after `supabase db reset`. Generated by scripts/seed/generate.ts.",
    "-- Real Irvine restaurant names from tests/fixtures/irvine_restaurants.csv, as hidden suggested competitors of",
    "-- Example Ramen House. Never create runs, answers, citations, fixes or any visibility for these names.",
    "begin;",
    `do $$ begin
  if not exists (select 1 from public.businesses where id = ${lit(IDS.business)}) then
    raise exception 'Example Ramen House is missing: run supabase db reset first';
  end if;
end $$;`,
    `delete from public.competitors where business_id = ${lit(IDS.business)} and source = 'suggested';`,
    `delete from public.local_places where city = 'Irvine' and state = 'CA' and not verified;`,
    insert(
      "competitors",
      competitors.map((c) => ({
        business_id: lit(IDS.business),
        name: lit(c.name),
        domain: lit(c.domain),
        source: lit("suggested"),
        hidden: "true",
      })),
    ),
    insert(
      "local_places",
      places.map((name) => ({ city: lit("Irvine"), state: lit("CA"), name: lit(name), kind: lit("landmark"), verified: "false" })),
    ),
    "commit;",
    "",
  ].join("\n");
}
