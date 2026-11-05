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
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";

const NOW = new Date("2026-11-05T12:00:00Z");
const business = { name: exampleBusiness.name };
const fixes = { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false };
const view = (p: Partial<Parameters<typeof ClientDashboard>[0]>) => (
  <ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={null} now={NOW} {...p} />
);

// Example data only.
const STATES: Record<string, () => ReactNode> = {
  success: () => view({}),
  fixes: () => view({ fixes }),
  partial: () => view({ latest: examplePartial, runs: [exampleFailedRun, ...exampleRuns] }),
  "no-run": () => view({ latest: null, runs: [] }),
  removed: () => view({ business: null, latest: null, runs: [] }),
  loading: () => <Skeleton title="Dashboard" />,
  error: () => <ErrorState title="Dashboard" message="We couldn't load your results. Try again." reset={() => {}} />,
};

export function Gallery({ state }: { state?: string }) {
  return (STATES[state ?? "success"] ?? STATES.success)();
}
