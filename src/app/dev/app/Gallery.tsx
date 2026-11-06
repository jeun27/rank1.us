"use client";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { Dashboard } from "@/components/app/Dashboard";
import { HistoryView } from "@/components/app/HistoryView";
import { QuestionsView } from "@/components/app/QuestionsView";
import { SourcesView } from "@/components/app/SourcesView";
import { latestMeasured, Measured, Page } from "@/components/app/Page";
import { BillingView } from "@/components/billing/BillingView";
import { BusinessSwitcher, type SwitcherBusiness } from "@/components/billing/BusinessSwitcher";
import { FixList } from "@/components/fixes/FixList";
import { ReportView } from "@/components/report/ReportView";
import type { ReportRow } from "@/lib/queries/reports";
import { exampleFixes as fixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
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
const fresh = { checkedAt: exampleQuestions.run!.finished_at, answers: 38, now: NOW };
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
    <SourcesView sources={computeSources({ questions: exampleQuestions.questions })} location={undefined} {...fresh} />
  ),
  "sources-partial": () => {
    const all = computeSources({ questions: exampleQuestions.questions });
    const engines = all.engines.map((e) =>
      e.engine === "perplexity" ? { ...e, links: 0, byCategory: e.byCategory.map((c) => ({ ...c, count: 0 })) } : e,
    );
    return <SourcesView sources={{ ...all, engines }} location={undefined} {...fresh} />;
  },
  "sources-location": () => {
    const key = computeSources({ questions: exampleQuestions.questions }).locations[0].key;
    return (
      <SourcesView
        sources={computeSources({ questions: exampleQuestions.questions, location: key })}
        location={key}
        {...fresh}
        answers={19}
      />
    );
  },
  "sources-empty": () => <SourcesView sources={null} location={undefined} />,
  "sources-loading": () => <Skeleton title="Sources" />,
  "sources-error": () => <ErrorState title="Sources" message={results} reset={() => {}} />,
  "fixes-success": () => (
    <Page title="What to fix next">
      <Measured {...latestMeasured(exampleLatest)} now={NOW} />
      <FixList ranked={fixes} tidyUps={exampleTidyUps} unchecked={[]} noDomain={false} canWrite onStatus={noop} />
    </Page>
  ),
  "fixes-partial": () => (
    <Page title="What to fix next">
      <Measured {...latestMeasured(exampleLatest)} now={NOW} />
      <FixList ranked={fixes.slice(1, 2)} tidyUps={[]} unchecked={exampleUnchecked} noDomain canWrite onStatus={noop} />
    </Page>
  ),
  "fixes-readonly": () => (
    <Page title="What to fix next">
      <Measured {...latestMeasured(exampleLatest)} now={NOW} />
      <FixList ranked={fixes} tidyUps={exampleTidyUps} unchecked={[]} noDomain={false} canWrite={false} />
    </Page>
  ),
  "fixes-empty": () => (
    <Page title="What to fix next">
      <FixList ranked={[]} tidyUps={[]} unchecked={[]} noDomain={false} canWrite />
    </Page>
  ),
  "fixes-loading": () => <Skeleton title="What to fix next" />,
  "fixes-error": () => <ErrorState title="What to fix next" message={results} reset={() => {}} />,
  "history-success": () => <HistoryView runs={allComplete} />,
  "history-partial": () => <HistoryView runs={[exampleFailedRun, ...exampleRuns]} />,
  "history-loading": () => <Skeleton title="History" />,
  "history-empty": () => <HistoryView runs={[]} />,
  "history-error": () => (
    <ErrorState title="History" message="We couldn't load your history. Try again." reset={() => {}} />
  ),
  "billing-unpaid": () => <BillingView billing={{ status: null, seats: 0, nextInvoiceAt: null }} actions={billing} />,
  "billing-paid": () => <BillingView billing={paidPlan} actions={billing} />,
  "billing-past-due": () => <BillingView billing={{ ...paidPlan, status: "past_due" }} actions={billing} />,
  "billing-failed": () => <BillingView billing={{ ...paidPlan, status: "unpaid" }} actions={billing} />,
  "billing-incomplete": () => <BillingView billing={{ ...paidPlan, status: "incomplete" }} actions={billing} />,
  "billing-paused": () => <BillingView billing={{ ...paidPlan, status: "paused" }} actions={billing} />,
  "billing-loading": () => <Skeleton title="Billing" />,
  "billing-error": () => <ErrorState title="Billing" message={results} reset={() => {}} />,
  "report-empty": () => <ReportView {...reportProps} reports={[]} />,
  "report-success": () => <ReportView {...reportProps} />,
  "report-partial": () => <ReportView {...reportProps} connectGa4Href="/app/settings/connections" />,
  "report-failed": () => (
    <ReportView
      {...reportProps}
      reports={[{ ...reportProps.reports[0], status: "failed" }, ...reportProps.reports.slice(1)]}
    />
  ),
  "report-loading": () => <Skeleton title="Reports" />,
  "report-error": () => <ErrorState title="Reports" message={results} reset={() => {}} />,
  "switcher-one": () => <WithSwitcher businesses={switcherBusinesses.slice(0, 1)} />,
  "switcher-many": () => <WithSwitcher businesses={switcherBusinesses} />,
};

// Example data: invented reports and settings; the preview is the real PDF on Example data.
const reportRow = (id: string, month: string, status: ReportRow["status"], has_pdf = true): ReportRow => ({
  id,
  period_start: `2026-${month}-01`,
  period_end: `2026-${month}-28`,
  status,
  sent_at: status === "sent" ? `2026-${month}-01T15:05:00Z` : null,
  recipients: 1,
  has_pdf,
});
const reportProps = {
  settings: { brand_color: "#1D5FC5", report_recipients: ["owner@exampleramen.test"], logoUrl: null },
  reports: [reportRow("r3", "10", "sent"), reportRow("r2", "09", "sent"), reportRow("r1", "08", "generated")],
  previewSrc: "/dev/report-preview.pdf",
  actions: {
    save: noop,
    uploadLogo: noop,
    sendTest: async () => ({ status: "sent" as const, email: "owner@exampleramen.test" }),
  },
};

// Example data: invented businesses and a paid plan. The switcher writes nothing here.
const billing = { checkout: noop, portal: noop };
const paidPlan = { status: "active" as const, seats: 3, nextInvoiceAt: "2026-12-01T00:00:00Z" };
const switcherBusinesses: SwitcherBusiness[] = [
  { id: "b1", name: "Example Ramen House", city: "Irvine", visibility: exampleRuns[0].visibility, active: true },
  { id: "b2", name: "Example Taco Stand", city: "Tustin", visibility: exampleRuns[1].visibility, active: true },
  { id: "b3", name: "Example Pho Spot", city: "Costa Mesa", visibility: null, active: false },
];
function WithSwitcher({ businesses }: { businesses: SwitcherBusiness[] }) {
  return (
    <div className="flex w-full flex-col">
      <header className="flex items-center gap-3 px-5 py-3 md:px-8">
        <BusinessSwitcher
          businesses={businesses}
          currentId="b1"
          seats={businesses.length}
          periodEnd="2026-12-01T00:00:00Z"
          actions={{ select: noop, add: noop, remove: noop, seats: async () => businesses.length }}
        />
      </header>
      <Page title="Dashboard">
        <p className="text-ui">{"Example data."}</p>
      </Page>
    </div>
  );
}

export function Gallery({ state = "dashboard-success", location: picked }: { state?: string; location?: string }) {
  // The location form round trip (QA #49): the form submits back here with ?location=.
  if (state === "sources-form") {
    const location = picked || undefined;
    return (
      <SourcesView
        sources={computeSources({ questions: exampleQuestions.questions, location })}
        location={location}
        {...fresh}
        formAction="/dev/app"
        formHidden={{ state: "sources-form" }}
      />
    );
  }
  return (STATES[state] ?? STATES["dashboard-success"])();
}
