// Example data: invented Irvine restaurants for the landing page mocks. Not real results.
import { formatPercent } from "@/components/ui/StatNumber";
import { pointsChange } from "@/app/dev/ui/example-data";
import type { Metric } from "@/types/metrics";

export { exampleCheck, exampleLeaderboard, pointsChange } from "@/app/dev/ui/example-data";

const metric = (numerator: number, denominator: number): Metric => ({
  value: denominator > 0 ? numerator / denominator : null,
  numerator,
  denominator,
});

// Hero card: this week's and last week's check for one example business.
export const heroThisWeek = metric(55, 160);
export const heroLastWeek = metric(45, 160);

// "named in 34% of 160 answers, +6 pts", computed, never typed.
export const heroCardText = (now: Metric, before: Metric) =>
  `named in ${formatPercent(now)} of ${now.denominator} answers, ${pointsChange(now, before)}`;

// Monthly report mock: Example Ramen House per engine (10 answers per question: 3/3/3/1 x 25 questions).
// Adds up to the leaderboard's 75 of 250 this week and 60 of 250 last week.
export const exampleEngines = [
  { engine: "ChatGPT", now: metric(24, 75), lastWeek: metric(20, 75) },
  { engine: "Gemini", now: metric(21, 75), lastWeek: metric(15, 75) },
  { engine: "Google AI Overview", now: metric(22, 75), lastWeek: metric(18, 75) },
  { engine: "Perplexity", now: metric(8, 25), lastWeek: metric(7, 25) },
];

// Audit CSV mock: one row per question and engine, named in n of the engine's runs.
export const exampleAuditRows = [
  { question: "best ramen in Irvine", engine: "ChatGPT", named: metric(2, 3) },
  { question: "best ramen in Irvine", engine: "Perplexity", named: metric(1, 1) },
  { question: "date night at Irvine Spectrum Center", engine: "Gemini", named: metric(0, 3) },
  { question: "lunch near Irvine Business Complex", engine: "Google AI Overview", named: metric(3, 3) },
];
