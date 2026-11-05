"use client";
import { useSearchParams } from "next/navigation";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { Dashboard } from "@/components/app/Dashboard";
import { HistoryView } from "@/components/app/HistoryView";
import { QuestionsView } from "@/components/app/QuestionsView";
import { SourcesView } from "@/components/app/SourcesView";
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
import { computeSources, seriesFromSummaries } from "@/lib/metrics";

const NOW = new Date("2026-11-05T14:30:00Z");
const series = seriesFromSummaries(exampleRuns);
const none = { points: [], visible: false };
const noop = async () => undefined;
const actions = { add: noop, dismiss: noop };
const results = "We couldn't load your results. Try again.";
// Success = everything answered; partial = the 4b partial state of the same page.
const allOk = {
  ...exampleQuestions,
  questions: exampleQuestions.questions.map((q) => ({
    ...q,
    answers: q.answers.map((a) =>
      a.status === "failed" ? { ...a, status: "ok" as const, mentioned: false, text: a.text ?? "Example data." } : a,
    ),
  })),
};
const allComplete = exampleRuns.map((r) => ({
  ...r,
  status: "complete" as const,
  jobs_ok: r.jobs_total,
  jobs_failed: 0,
}));

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
  "dashboard-error": () => <ErrorState title="Dashboard" message={results} reset={() => {}} />,
  "competitors-success": () => (
    <CompetitorsView
      latest={exampleLatest}
      tracked={exampleTracked}
      suggestions={exampleSuggestions}
      actions={actions}
      now={NOW}
    />
  ),
  "competitors-partial": () => (
    <CompetitorsView latest={examplePartial} tracked={exampleTracked} suggestions={[]} actions={actions} now={NOW} />
  ),
  "competitors-loading": () => <Skeleton title="Competitors" />,
  "competitors-error": () => <ErrorState title="Competitors" message={results} reset={() => {}} />,
  "competitors-empty": () => (
    <CompetitorsView latest={null} tracked={[]} suggestions={[]} actions={actions} now={NOW} />
  ),
  "questions-success": () => <QuestionsView data={allOk} />,
  "questions-partial": () => <QuestionsView data={exampleQuestions} />,
  "questions-loading": () => <Skeleton title="Questions" />,
  "questions-error": () => <ErrorState title="Questions" message={results} reset={() => {}} />,
  "questions-empty": () => <QuestionsView data={{ run: null, questions: [] }} />,
  "sources-success": () => (
    <SourcesView sources={computeSources({ questions: exampleQuestions.questions })} location={undefined} />
  ),
  "sources-partial": () => {
    const all = computeSources({ questions: exampleQuestions.questions });
    const engines = all.engines.map((e) =>
      e.engine === "perplexity" ? { ...e, links: 0, byCategory: e.byCategory.map((c) => ({ ...c, count: 0 })) } : e,
    );
    return <SourcesView sources={{ ...all, engines }} location={undefined} />;
  },
  "sources-location": () => {
    const key = computeSources({ questions: exampleQuestions.questions }).locations[0].key;
    return (
      <SourcesView sources={computeSources({ questions: exampleQuestions.questions, location: key })} location={key} />
    );
  },
  "sources-empty": () => <SourcesView sources={null} location={undefined} />,
  "sources-loading": () => <Skeleton title="Sources" />,
  "sources-error": () => <ErrorState title="Sources" message={results} reset={() => {}} />,
  "history-success": () => <HistoryView runs={allComplete} />,
  "history-partial": () => <HistoryView runs={[exampleFailedRun, ...exampleRuns]} />,
  "history-loading": () => <Skeleton title="History" />,
  "history-empty": () => <HistoryView runs={[]} />,
  "history-error": () => (
    <ErrorState title="History" message="We couldn't load your history. Try again." reset={() => {}} />
  ),
};

export function Gallery() {
  const state = useSearchParams().get("state") ?? "dashboard-success";
  return (STATES[state] ?? STATES["dashboard-success"])();
}
