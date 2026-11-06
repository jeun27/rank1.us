// Example data for the /dev/app experiments states: invented tests, not real results.
import { computeExperiment } from "@/lib/metrics/experiment";
import type { ExperimentCardView } from "./ExperimentList";

export const exampleExperiments: ExperimentCardView[] = [
  {
    id: "x1",
    name: "Crawlable HTML menu on your own site",
    changeDate: "2026-10-20",
    status: "running",
    result: computeExperiment({
      test: { before: { named: 40, n: 120 }, after: { named: 52, n: 120 } },
      control: { before: { named: 30, n: 100 }, after: { named: 33, n: 100 } },
    }),
  },
  {
    id: "x2",
    name: "Hours on the Google Business Profile",
    changeDate: "2026-09-08",
    status: "done",
    result: computeExperiment({
      test: { before: { named: 24, n: 80 }, after: { named: 22, n: 80 } },
      control: { before: { named: 35, n: 120 }, after: { named: 36, n: 120 } },
    }),
  },
];

// One cell under 10 answers: the partial state.
export const exampleTooFew: ExperimentCardView[] = [
  {
    id: "x3",
    name: "FAQ block on the menu page",
    changeDate: "2026-11-02",
    status: "running",
    result: computeExperiment({
      test: { before: { named: 12, n: 40 }, after: { named: 3, n: 8 } },
      control: { before: { named: 20, n: 60 }, after: { named: 4, n: 12 } },
    }),
  },
];

export const exampleTestQuestions = [
  { id: "q1", text: "best ramen in Irvine" },
  { id: "q2", text: "ramen near Irvine Spectrum Center" },
  { id: "q3", text: "late night ramen in Irvine" },
  { id: "q4", text: "vegan ramen in Irvine" },
];
