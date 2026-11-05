// Example data: an invented Irvine ramen audit for the /dev/audit gallery and unit tests. Not real results.
import { ENGINES, type Engine, type Metrics, type RunResults, type RunStatus } from "./contract";

const brands: RunResults["brands"] = [
  { name: "Example Ramen House", kind: "business", domain: "exampleramen.test" },
  { name: "Example Noodle Bar", kind: "competitor", domain: "examplenoodle.test" },
  { name: "Example Izakaya", kind: "competitor", domain: null },
  { name: "Example Udon House", kind: "competitor", domain: "exampleudon.test" },
];

// 25 questions → 250 jobs (3/3/3/1 per question).
export function exampleRun(
  status: RunStatus,
  opts: {
    kind?: RunResults["run"]["kind"];
    done?: Partial<Record<Engine, number>>;
    failed?: Partial<Record<Engine, number>>;
  } = {},
): RunResults {
  const done = opts.done ?? { chatgpt: 75, gemini: 75, google_aio: 75, perplexity: 25 };
  const answers: RunResults["answers"] = ENGINES.flatMap((engine) =>
    Array.from({ length: done[engine] ?? 0 }, (_, i) => ({
      id: `${engine}-${i}`,
      engine,
      run_index: (i % 3) + 1,
      status: i < (opts.failed?.[engine] ?? 0) ? ("failed" as const) : ("ok" as const),
      question_id: opts.kind === "free_audit" ? null : `q${Math.floor(i / 3)}`,
      question_text_used: "best ramen in Irvine",
      mentioned: i % 3 === 0,
      first_position: i % 3 === 0 ? 2 : null,
      brands: [{ name: "Example Noodle Bar", position: 1 }],
      location_used: "Irvine, CA, US",
      location_supported:
        engine === "chatgpt" || engine === "gemini" ? ("fallback_country" as const) : ("exact" as const),
      checked_at: "2026-11-05T12:30:00Z",
    })),
  );
  return {
    run: {
      id: "example-run",
      kind: opts.kind ?? "audit",
      status,
      jobs_total: 250,
      jobs_ok: answers.filter((a) => a.status === "ok").length,
      jobs_failed: answers.filter((a) => a.status === "failed").length,
      started_at: "2026-11-05T12:00:00Z",
      finished_at: status === "queued" || status === "running" ? null : "2026-11-05T12:40:00Z",
      business_id: opts.kind === "free_audit" ? null : "example-business",
    },
    label: opts.kind === "free_audit" ? "exampleramen.test" : "Example Ramen House",
    brands,
    answers,
    citations: [
      {
        answer_id: "chatgpt-0",
        url: "https://example-reviews.test/irvine/ramen",
        domain: "example-reviews.test",
        title: "Example data: best ramen",
        category: "review_directory",
      },
      {
        answer_id: "gemini-0",
        url: "https://example-blog.test/ramen-guide",
        domain: "example-blog.test",
        title: "Example data: ramen guide",
        category: "news_blog",
      },
    ],
  };
}

const share = (named: number, n: number) => ({ named, n, pct: n ? named / n : 0 });

export const exampleMetrics: Metrics = {
  visibility: {
    ...share(80, 240),
    byEngine: {
      chatgpt: share(25, 72),
      gemini: share(24, 72),
      google_aio: share(23, 72),
      perplexity: share(8, 24),
    },
  },
  leaderboard: [
    { name: "Example Noodle Bar", kind: "competitor", ...share(240, 240), change: null, tooFew: false },
    { name: "Example Ramen House", kind: "business", ...share(80, 240), change: null, tooFew: false },
    { name: "Example Izakaya", kind: "competitor", ...share(6, 8), change: null, tooFew: true },
  ],
  sources: [
    { domain: "example-reviews.test", category: "review_directory", count: 12 },
    { domain: "example-blog.test", category: "news_blog", count: 7 },
  ],
  jobs: { ok: 240, failed: 10 },
  freshness: "2026-11-05T12:30:00Z",
};
