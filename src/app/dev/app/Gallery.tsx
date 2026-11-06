"use client";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { MentionsEvidence, MentionsSection } from "@/components/mentions/MentionsSection";
import { exampleMentions, exampleMentionsNone } from "@/components/mentions/example-data";
import { AiAccessPanel, AiReassure } from "@/components/audit/AiAccessPanel";
import { exampleAiAccess } from "@/components/audit/example-data";
import { Dashboard } from "@/components/app/Dashboard";
import { HistoryView } from "@/components/app/HistoryView";
import { QuestionsView } from "@/components/app/QuestionsView";
import { SourcesView } from "@/components/app/SourcesView";
import { latestMeasured, Measured, Page } from "@/components/app/Page";
import { AppShell } from "@/components/app/AppShell";
import { BillingView } from "@/components/billing/BillingView";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BusinessSwitcher, type SwitcherBusiness } from "@/components/billing/BusinessSwitcher";
import { ExperimentForm } from "@/components/experiments/ExperimentForm";
import { ExperimentList } from "@/components/experiments/ExperimentList";
import { exampleExperiments, exampleTestQuestions, exampleTooFew } from "@/components/experiments/example-data";
import { ConnectionsHub } from "@/components/connections/ConnectionsHub";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { exampleCards, exampleConnected, exampleHub } from "@/components/connections/example-data";
import { FixList } from "@/components/fixes/FixList";
import { ReportView } from "@/components/report/ReportView";
import type { ReportRow } from "@/lib/queries/reports";
import { exampleDone, exampleFixes as fixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
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
const experiment = { end: noop, remove: noop };
// G5: the example fixes with their pillars (robots.txt is P5 Technical access; the menu, dish pages and the
// schema tidy-up are P2 Content), and the P0 baseline from the example run.
const pillarFixes = fixes.map((f) => ({ ...f, pillar: f.rule_key === "R14" ? ("p5" as const) : ("p2" as const) }));
const pillarTidyUps = exampleTidyUps.map((f) => ({ ...f, pillar: "p2" as const }));
const pillarDone = exampleDone.map((f) => ({ ...f, pillar: "p2" as const }));
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
  // C-b: the connect card on the dashboard (ENABLE_CONNECTIONS), and the onboarding connect step.
  ...Object.fromEntries(
    (["connect", "reauth", "readonly", "ready"] as const).map((k) => [
      `dashboard-${k === "ready" ? "all-set" : `card-${k}`}`,
      () => (
        <Dashboard
          business={exampleBusiness}
          latest={exampleLatest}
          series={series}
          fixes={exampleFixes}
          now={NOW}
          notice={<ConnectCard {...exampleCards[k]} />}
        />
      ),
    ]),
  ),
  "onboarding-connect": () => <ConnectStep card={exampleCards.connect} />,
  "onboarding-connect-done": () => <ConnectStep card={{ ...exampleCards.ready, fixesHref: null }} />,
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
  // G7: the mentions section at the top of Sources (ENABLE_MENTIONS), and the R17 fix's evidence.
  ...Object.fromEntries(
    (
      [
        ["sources-mentions", exampleMentions, true],
        ["sources-mentions-readonly", exampleMentions, false],
        ["sources-mentions-first", null, true],
        ["sources-mentions-none", exampleMentionsNone, true],
      ] as const
    ).map(([k, targets, canDecide]) => [
      k,
      () => (
        <SourcesView
          sources={computeSources({ questions: exampleQuestions.questions })}
          location={undefined}
          {...fresh}
          mentions={
            <MentionsSection
              targets={targets}
              canDecide={canDecide}
              fixId="example-r17"
              decide={async () => ({ fixId: "example-r17" })}
            />
          }
        />
      ),
    ]),
  ),
  "fixes-mentions": () => (
    <Page title="What to fix next">
      <Measured {...latestMeasured(exampleLatest)} now={NOW} />
      <FixList
        ranked={[
          {
            ...fixes[0],
            id: "example-r17",
            rule_key: "R17",
            title: "Get on these lists",
            detail: "1 list AI cites names Example Noodle Bar, Example Izakaya but not you.",
            pillar: "p3",
            evidence: <MentionsEvidence added={[...exampleMentions.added, ...exampleMentions.candidates]} />,
          },
          ...pillarFixes.slice(1),
        ]}
        tidyUps={[]}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={noop}
      />
    </Page>
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
      <FixList
        ranked={pillarFixes}
        tidyUps={pillarTidyUps}
        done={pillarDone}
        baseline={exampleLatest.metrics.visibility}
        baselineHref="/app"
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={noop}
      />
    </Page>
  ),
  // G2: the AI access panel as the evidence on the R14 fix, and the dashboard's quiet good line.
  "fixes-ai-access": () => (
    <Page title="What to fix next">
      <Measured {...latestMeasured(exampleLatest)} now={NOW} />
      <FixList
        ranked={pillarFixes.map((f) =>
          f.rule_key === "R14"
            ? { ...f, evidence: <AiAccessPanel check={exampleAiAccess("search")} now={NOW} level={4} /> }
            : f,
        )}
        tidyUps={pillarTidyUps}
        done={pillarDone}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={noop}
      />
    </Page>
  ),
  "dashboard-ai-good": () => (
    <Dashboard
      business={exampleBusiness}
      latest={exampleLatest}
      series={series}
      fixes={exampleFixes}
      now={NOW}
      reassure={<AiReassure check={exampleAiAccess("good")} now={NOW} />}
    />
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
      <FixList
        ranked={pillarFixes}
        tidyUps={pillarTidyUps}
        done={pillarDone}
        baseline={exampleLatest.metrics.visibility}
        baselineHref="/app"
        unchecked={[]}
        noDomain={false}
        canWrite={false}
      />
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
  "experiments-empty": () => (
    <Page title="Experiments">
      <ExperimentList experiments={[]} canWrite actions={experiment} />
    </Page>
  ),
  "experiments-success": () => (
    <Page title="Experiments">
      <ExperimentList experiments={exampleExperiments} canWrite actions={experiment} />
    </Page>
  ),
  "experiments-partial": () => (
    <Page title="Experiments">
      <ExperimentList experiments={exampleTooFew} canWrite actions={experiment} />
    </Page>
  ),
  "experiments-loading": () => <Skeleton title="Experiments" />,
  "experiments-error": () => <ErrorState title="Experiments" message={results} reset={() => {}} />,
  "experiments-form": () => (
    <Page title="Start a test">
      <ExperimentForm questions={exampleTestQuestions} today="2026-11-05" onCreate={noop} />
    </Page>
  ),
  "connections-restaurant": () => <Hub />,
  "connections-saas": () => <Hub industry="saas" />,
  "connections-connected": () => <Hub {...exampleConnected} />,
  "connections-outcome-connected": () => <Hub outcome={{ connector: "gbp", status: "connected" }} />,
  "connections-outcome-denied": () => <Hub outcome={{ connector: "gbp", status: "denied" }} />,
  "connections-outcome-error": () => <Hub outcome={{ connector: "gbp", status: "error" }} />,
  "connections-readonly": () => <Hub {...exampleConnected} canConnect={false} />,
  "connections-loading": () => <Skeleton title="Connections" />,
  "connections-error": () => <ErrorState title="Connections" message={results} reset={() => {}} />,
  "switcher-one": () => <WithSwitcher />,
  "switcher-many": () => <WithSwitcher />,
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
// The switcher sits in the shell's breadcrumb (D42), as in the real /app layout.
const switcher = (businesses: SwitcherBusiness[]) => (
  <BusinessSwitcher
    businesses={businesses}
    currentId="b1"
    seats={businesses.length}
    periodEnd="2026-12-01T00:00:00Z"
    actions={{ select: noop, add: noop, remove: noop, seats: async () => businesses.length }}
  />
);
// Settings → Connections on Example data (shown here whatever ENABLE_CONNECTIONS says).
// The /app/onboarding/connect layout, on Example data.
function ConnectStep({ card }: { card: React.ComponentProps<typeof ConnectCard> }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 md:px-8 md:py-16">
      <h1 className="font-display text-display font-semibold">Add your business</h1>
      <ConnectCard {...card} returnTo="/app/onboarding/connect" skipHref="/app" />
    </main>
  );
}
function Hub(over: Partial<React.ComponentProps<typeof ConnectionsHub>>) {
  return (
    <Page title="Connections">
      <ConnectionsHub {...exampleHub(over)} />
    </Page>
  );
}
function WithSwitcher() {
  return (
    <Page title="Dashboard">
      <p className="text-ui">{"Example data."}</p>
    </Page>
  );
}
const CRUMB: Record<string, string> = {
  dashboard: "Dashboard",
  competitors: "Competitors",
  questions: "Questions",
  sources: "Sources",
  fixes: "What to fix next",
  history: "History",
  billing: "Billing",
  report: "Reports",
  experiments: "Experiments",
  connections: "Settings",
  switcher: "Dashboard",
};

// Every state inside the v3 shell (rail + breadcrumb), Example data only.
export function Gallery({ state = "dashboard-success", location }: { state?: string; location?: string }) {
  const business = state.startsWith("switcher-")
    ? switcher(state === "switcher-one" ? switcherBusinesses.slice(0, 1) : switcherBusinesses)
    : exampleBusiness.name;
  return (
    <AppShell
      business={business}
      actions={<ThemeToggle />}
      page={state === "experiments-form" ? "Start a test" : (CRUMB[state.split("-")[0]] ?? "Dashboard")}
    >
      <div className="mx-auto flex w-full max-w-page">
        <State state={state} location={location} />
      </div>
    </AppShell>
  );
}

function State({ state, location: picked }: { state: string; location?: string }) {
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
