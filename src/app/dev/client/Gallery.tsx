"use client";
import type { ReactNode } from "react";
import {
  exampleBusiness,
  exampleFailedRun,
  exampleLatest,
  examplePartial,
  exampleRuns,
} from "@/components/app/example-data";
import { ErrorState, Skeleton } from "@/components/app/states";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { exampleCards } from "@/components/connections/example-data";
import { exampleDone, exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";
import { NarrativeDashboard } from "@/components/narrative/NarrativeDashboard";
import { exampleNarrative, exampleNarrativeNoClash } from "@/components/narrative/example-data";

const NOW = new Date("2026-11-05T12:00:00Z");
const business = { name: exampleBusiness.name };
const fixes = { ranked: exampleFixes, tidyUps: exampleTidyUps, done: exampleDone, unchecked: [], noDomain: false };
const view = (p: Partial<Parameters<typeof ClientDashboard>[0]>) => (
  <ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={null} now={NOW} {...p} />
);

// Example data only.
const STATES: Record<string, () => ReactNode> = {
  success: () => view({}),
  fixes: () => view({ fixes }),
  partial: () => view({ latest: examplePartial, runs: [exampleFailedRun, ...exampleRuns] }),
  "no-run": () => view({ latest: null, runs: [] }),
  "no-run-fixes": () => view({ latest: null, runs: [], fixes }),
  removed: () => view({ business: null, latest: null, runs: [] }),
  // C-b: the connect card for a DFY client, and its all-set state (lead Q1 copy).
  connect: () => view({ notice: <ConnectCard {...exampleCards.connect} returnTo="/client" audience="dfy" /> }),
  "all-set": () =>
    view({ notice: <ConnectCard {...exampleCards.ready} returnTo="/client" audience="dfy" fixesHref={null} /> }),
  // Q4: the read-only narrative clash card; no clash renders nothing.
  narrative: () => view({ narrative: <NarrativeDashboard view={exampleNarrative} readOnly /> }),
  "narrative-no-clash": () => view({ narrative: <NarrativeDashboard view={exampleNarrativeNoClash} readOnly /> }),
  loading: () => <Skeleton title="Dashboard" />,
  error: () => <ErrorState title="Dashboard" message="We couldn't load your results." reset={() => {}} />,
};

export function Gallery({ state }: { state?: string }) {
  return (STATES[state ?? "success"] ?? STATES.success)();
}
