// Example data: invented Irvine ramen numbers for the /dev/app gallery and unit tests. Not real results.
import { exampleMetrics, exampleRun } from "@/components/audit/example-data";
import { ENGINE_IDS } from "@/lib/engines/types";
import { metric } from "@/lib/metrics";
import type { QuestionsWithLatestAnswers, RunSummary, TopFix } from "@/lib/queries/shell";

export const exampleBusiness = { name: "Example Ramen House", paid: true };
export const exampleLatest = { results: exampleRun("complete"), metrics: exampleMetrics };
export const examplePartial = { results: exampleRun("partial"), metrics: exampleMetrics };

const perEngine = (n: number) =>
  Object.fromEntries(
    ENGINE_IDS.map((e) => [e, metric(Math.round(n / 4), e === "perplexity" ? 24 : 72)]),
  ) as RunSummary["perEngine"];

// Newest first, as listRunSummaries returns them.
export const exampleRuns: RunSummary[] = [80, 72, 75, 60, 66, 58, 51, 44].map((named, i) => ({
  id: `example-run-${i + 1}`,
  kind: "weekly",
  status: i === 1 ? "partial" : "complete",
  jobs_total: 250,
  jobs_ok: i === 1 ? 230 : 250,
  jobs_failed: i === 1 ? 20 : 0,
  started_at: new Date(Date.UTC(2026, 10, 2 - 7 * i, 14)).toISOString(),
  finished_at: new Date(Date.UTC(2026, 10, 2 - 7 * i, 14, 40)).toISOString(),
  visibility: metric(named, 240),
  perEngine: perEngine(named),
}));
export const exampleFailedRun: RunSummary = {
  ...exampleRuns[0],
  id: "example-run-failed",
  status: "failed",
  jobs_ok: 0,
  jobs_failed: 250,
  visibility: metric(0, 0),
};

export const exampleFixes: TopFix[] = [
  {
    id: "f1",
    rule_key: "R10",
    size: "S",
    title: "Example data: add your menu to your Google Business Profile",
    detail: null,
    affected_answers: 41,
    status: "todo",
  },
  {
    id: "f2",
    rule_key: "R11",
    size: "M",
    title: "Example data: get listed on example-reviews.test",
    detail: null,
    affected_answers: 23,
    status: "doing",
  },
  {
    id: "f3",
    rule_key: "R14",
    size: "S",
    title: "Example data: answer 'vegan ramen' on your site",
    detail: null,
    affected_answers: 9,
    status: "todo",
  },
];

export const exampleSuggestions = [
  { name: "Example Tonkotsu Co.", domain: "exampletonkotsu.test", rating: 4.3, cid: "s1" },
  { name: "Example Pho Spot", domain: "examplepho.test", rating: 4.1, cid: "s2" },
];
export const exampleTracked = [
  { id: "c1", name: "Example Noodle Bar", domain: "examplenoodle.test", source: "maps" as const, rating: 4.6 },
  { id: "c2", name: "Example Izakaya", domain: null, source: "manual" as const, rating: null },
];

export const exampleQuestions: QuestionsWithLatestAnswers = {
  run: { id: "example-run-1", finished_at: "2026-11-02T14:40:00Z" },
  questions: ["best ramen in Irvine", "ramen near Diamond Jamboree"].map((text, qi) => ({
    id: `q${qi + 1}`,
    text,
    active: true,
    location_level: qi === 0 ? ("city" as const) : ("country" as const),
    country: "US",
    state: qi === 0 ? "CA" : null,
    city: qi === 0 ? "Irvine" : null,
    answers: ENGINE_IDS.flatMap((engine) =>
      Array.from({ length: engine === "perplexity" ? 1 : 3 }, (_, i) => ({
        engine,
        run_index: i + 1,
        status: engine === "gemini" && i === 2 ? ("failed" as const) : ("ok" as const),
        mentioned: engine === "gemini" && i === 2 ? null : (i + qi) % 2 === 0,
        text:
          engine === "gemini" && i === 2
            ? null
            : `Example data. Picks for "${text}": Example Noodle Bar, Example Ramen House`,
        location_used: "Irvine, CA, US",
        location_supported:
          engine === "chatgpt" || engine === "gemini" ? ("fallback_country" as const) : ("exact" as const),
        checked_at: "2026-11-02T14:20:00Z",
        citations:
          i === 0
            ? [
                {
                  url: "https://example-reviews.test/irvine/ramen",
                  domain: "example-reviews.test",
                  title: null,
                  position: 1,
                  category: "review_directory" as const,
                },
              ]
            : [],
      })),
    ),
  })),
};
