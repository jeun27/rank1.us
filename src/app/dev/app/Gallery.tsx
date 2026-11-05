"use client";
import { useSearchParams } from "next/navigation";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { Dashboard } from "@/components/app/Dashboard";
import { HistoryView } from "@/components/app/HistoryView";
import { QuestionsView } from "@/components/app/QuestionsView";
import { ErrorState, Skeleton } from "@/components/app/states";
import {
  exampleBusiness,
  exampleFailedRun,
  exampleFixes,
  exampleLatest,
  examplePartial,
  exampleQuestions,
  exampleRuns,
  exampleSuggestions,
  exampleTracked,
} from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

const NOW = new Date("2026-11-05T14:30:00Z");
const series = seriesFromSummaries(exampleRuns);
const none = { points: [], visible: false };
const noop = async () => undefined;
const actions = { add: noop, dismiss: noop };

// Every UI.md 4b state of the self-serve pages with Example data. ?state= picks one.
export const STATES: Record<string, () => React.ReactNode> = {
  "dashboard-empty": () => <Dashboard business={null} latest={null} series={none} fixes={[]} now={NOW} />,
  "dashboard-unpaid": () => (
    <Dashboard business={{ ...exampleBusiness, paid: false }} latest={null} series={none} fixes={[]} now={NOW} />
  ),
  "dashboard-first-check": () => (
    <Dashboard business={exampleBusiness} latest={null} series={none} fixes={[]} now={NOW} />
  ),
  "dashboard-success": () => (
    <Dashboard business={exampleBusiness} latest={exampleLatest} series={series} fixes={exampleFixes} now={NOW} />
  ),
  "dashboard-partial": () => (
    <Dashboard
      business={exampleBusiness}
      latest={examplePartial}
      series={seriesFromSummaries(exampleRuns.slice(0, 1))}
      fixes={[]}
      now={NOW}
    />
  ),
  "dashboard-loading": () => <Skeleton title="Dashboard" />,
  "dashboard-error": () => (
    <ErrorState title="Dashboard" message="We couldn't load your results. Try again." reset={() => {}} />
  ),
  "competitors-success": () => (
    <CompetitorsView
      latest={exampleLatest}
      tracked={exampleTracked}
      suggestions={exampleSuggestions}
      actions={actions}
      now={NOW}
    />
  ),
  "competitors-empty": () => (
    <CompetitorsView latest={null} tracked={[]} suggestions={[]} actions={actions} now={NOW} />
  ),
  "questions-success": () => <QuestionsView data={exampleQuestions} />,
  "questions-empty": () => <QuestionsView data={{ run: null, questions: [] }} />,
  "history-success": () => <HistoryView runs={[exampleFailedRun, ...exampleRuns]} />,
  "history-empty": () => <HistoryView runs={[]} />,
  "history-error": () => (
    <ErrorState title="History" message="We couldn't load your history. Try again." reset={() => {}} />
  ),
};

export function Gallery() {
  const state = useSearchParams().get("state") ?? "dashboard-success";
  return (STATES[state] ?? STATES["dashboard-success"])();
}
