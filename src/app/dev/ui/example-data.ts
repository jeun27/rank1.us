// Example data: invented Irvine restaurants for the component gallery. Not real results.
import { formatPercent } from "@/components/ui/StatNumber";
import type { Metric } from "@/types/metrics";

const metric = (numerator: number, denominator: number): Metric => ({
  value: denominator > 0 ? numerator / denominator : null,
  numerator,
  denominator,
});

// Fixed times so the gallery renders the same every time: "Checked 14 h ago".
export const exampleCheck = { checkedAt: new Date("2026-11-04T22:00:00Z"), now: new Date("2026-11-05T12:00:00Z"), answers: 250 };

export const exampleLeaderboard = [
  { brand: "Example Ramen House", you: true, now: metric(75, 250), lastWeek: metric(60, 250) },
  { brand: "Example Noodle Bar", you: false, now: metric(95, 250), lastWeek: metric(100, 250) },
  { brand: "Example Izakaya", you: false, now: metric(40, 250), lastWeek: metric(40, 250) },
];

export const exampleVisibility = metric(9, 30);
export const exampleNoAnswers = metric(0, 0);

// A partial weekly run and an in-progress audit (docs/COPY.md wording).
export const examplePartialRun = { jobsOk: 230, jobsTotal: 250 };
export const exampleProgress = { answersDone: 120, answersTotal: 250 };

export function pointsChange(now: Metric, before: Metric) {
  const pts = parseInt(formatPercent(now)) - parseInt(formatPercent(before));
  return pts === 0 ? "0 pts" : `${pts > 0 ? "+" : "−"}${Math.abs(pts)} pts`;
}

export const partialRunLabel = ({ jobsOk, jobsTotal }: typeof examplePartialRun) =>
  `Last run partial: ${jobsOk} of ${jobsTotal} answers`;

export const progressLabel = ({ answersDone, answersTotal }: typeof exampleProgress) =>
  `Checking 4 AI engines… ${answersDone} of ${answersTotal} answers`;

// Example domains typed into the Field + Button states (the design's Example Ramen House).
export const exampleDomain = "ramenhouse.com";
export const exampleDomainNoEnding = "ramenhouse";
