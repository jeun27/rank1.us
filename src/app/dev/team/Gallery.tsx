"use client";
import { exampleSuggestions } from "@/components/app/example-data";
import { exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
import { NoClients } from "@/components/workspace/NoClients";
import { Workspace } from "@/components/workspace/Workspace";
import type { TeamExtras } from "@/components/workspace/team";
import { buildWorkspace } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";

const view = buildWorkspace(exampleWorkspaceRows());
const noop = async () => undefined;

// Example data only. input null keeps #11's Example brief; writes do nothing here.
const extras: TeamExtras = {
  businesses: [
    { id: view.business.id, name: view.business.name },
    { id: "example-client-2", name: "Example Taco Stand" },
  ],
  businessId: view.business.id,
  formAction: "/dev/team",
  input: null,
  fixes: { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: exampleUnchecked.slice(0, 1), noDomain: false },
  suggestions: exampleSuggestions,
  actions: { status: noop, add: noop, dismiss: noop },
};

export function Gallery({ state }: { state?: string }) {
  if (state === "no-clients") return <NoClients />;
  return <Workspace view={view} team={extras} />;
}
