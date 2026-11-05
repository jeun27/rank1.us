// Example data rows for supabase/seed.sql: deterministic (fixed RNG seed, ids hashed from labels).
// No file reads, so the /app Example data workspace can import it.
import { createHash } from "node:crypto";
import { exampleRamenHouseQuestions } from "../../tests/fixtures/example-ramen-house";

export const ENGINES = ["chatgpt", "gemini", "google_aio", "perplexity"] as const;
export type Engine = (typeof ENGINES)[number];
export const RUNS_PER_ENGINE: Record<Engine, number> = { chatgpt: 3, gemini: 3, google_aio: 3, perplexity: 1 };
// Google AI Overview and Perplexity can target the city; ChatGPT and Gemini fall back to the country.
export const cityLevel = (engine: Engine) => engine === "google_aio" || engine === "perplexity";

export const BUSINESS = "Example Ramen House";
export const COMPETITORS = [
  "Example Noodle Bar",
  "Example Izakaya",
  "Example Tonkotsu Co.",
  "Example Udon House",
  "Example Pho Spot",
];

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

export function seedRows() {
  const rand = mulberry32(1);
  const questions = exampleRamenHouseQuestions.map((q, i) => ({ ...q, id: id(`question:${i + 1}`) }));
  const runs: {
    id: string;
    started_at: string;
    finished_at: string;
    jobs_total: number;
    jobs_ok: number;
    jobs_failed: number;
  }[] = [];
  const answers: AnswerSeed[] = [];
  const citations: {
    id: string;
    answer_id: string;
    url: string;
    domain: string;
    title: string;
    position: number;
    category: string;
  }[] = [];

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

  return { questions, runs, answers, citations };
}
