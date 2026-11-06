// Example data for the landing hero demo (v3 PR 3, lead Q1): invented Irvine restaurants, not real results.
// The card line, the engine bars and the leaderboard all derive from this one fixture.
import type { Metric } from "@/types/metrics";

const metric = (numerator: number, denominator: number): Metric => ({
  value: denominator > 0 ? numerator / denominator : null,
  numerator,
  denominator,
});
const sum = (ms: Metric[]) =>
  metric(
    ms.reduce((n, m) => n + m.numerator, 0),
    ms.reduce((d, m) => d + m.denominator, 0),
  );

export const demoQuestion = "best ramen in Irvine";
export const demoYou = "Example Ramen House";

// 40 answers per engine this week.
export const demoEngines = [
  { engine: "ChatGPT", named: metric(16, 40) },
  { engine: "Gemini", named: metric(13, 40) },
  { engine: "Google AI Overview", named: metric(15, 40) },
  { engine: "Perplexity", named: metric(11, 40) },
];
export const demoThisWeek = sum(demoEngines.map((e) => e.named));
export const demoLastWeek = metric(45, demoThisWeek.denominator);

// Rivals out of the same 160 answers. You climb past exactly one of them this week.
const demoRivals = [
  { brand: "Example Izakaya", named: metric(70, demoThisWeek.denominator) },
  { brand: "Example Udon House", named: metric(50, demoThisWeek.denominator) },
  { brand: "Example Pho Spot", named: metric(38, demoThisWeek.denominator) },
];

export function demoBoard(you: Metric) {
  return [...demoRivals.map((r) => ({ ...r, you: false })), { brand: demoYou, named: you, you: true }]
    .sort((a, b) => (b.named.value ?? 0) - (a.named.value ?? 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// One run, in ms: type the question, fill the engine bars, count the visibility up, then the climb.
const T = { typed: 1200, barsFrom: 1300, barsTo: 2300, countTo: 3100, climb: 3300, done: 3700 };
const progress = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));

export function demoFrame(t: number) {
  const count = progress(t, T.barsTo, T.countTo);
  const { numerator: a, denominator } = demoLastWeek;
  return {
    typed: demoQuestion.slice(0, Math.floor(progress(t, 0, T.typed) * demoQuestion.length)),
    bars: progress(t, T.barsFrom, T.barsTo),
    visibility:
      count >= 1
        ? demoThisWeek
        : count <= 0
          ? demoLastWeek
          : metric(Math.round(a + (demoThisWeek.numerator - a) * count), denominator),
    climbed: t >= T.climb,
    done: t >= T.done,
  };
}
export const DEMO_MS = T.done;
