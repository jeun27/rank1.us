// Example data: invented Irvine restaurants for the component gallery. Not real results.
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
