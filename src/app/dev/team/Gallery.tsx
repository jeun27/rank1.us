"use client";
import { exampleSuggestions } from "@/components/app/example-data";
import { exampleDone, exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
import { NoClients } from "@/components/workspace/NoClients";
import { Workspace } from "@/components/workspace/Workspace";
import type { TeamExtras } from "@/components/workspace/team";
import type { QueueRow } from "@/lib/workspace/queue";
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
  fixes: {
    ranked: exampleFixes,
    tidyUps: exampleTidyUps,
    done: exampleDone,
    unchecked: exampleUnchecked.slice(0, 1),
    noDomain: false,
  },
  loadSuggestions: async () => exampleSuggestions,
  clients: { users: [{ user_id: "example-user", email: "owner@exampleramen.test" }], fixListVisible: false },
  actions: {
    status: noop,
    add: noop,
    dismiss: noop,
    invite: async (_b: string, email: string) =>
      ({ status: email.includes("@") ? "invited" : "invalid_email" }) as const,
    removeClient: noop,
    setFixListVisible: noop,
  },
};

// X5: the client queue (Example data), one client per tag; /team opens on it.
const m = (n: number, d: number) => ({ value: n / d, numerator: n, denominator: d });
const queue: QueueRow[] = [
  { id: "example-client-4", name: "Example Noodle Bar", tag: "attention", visibility: m(48, 240), delta: -4, open: 3 },
  { id: view.business.id, name: view.business.name, tag: "ready", visibility: m(70, 233), delta: 6, open: 4 },
  { id: "example-client-2", name: "Example Taco Stand", tag: "waiting", visibility: null, delta: null, open: 2 },
  { id: "example-client-3", name: "Example Pho Spot", tag: "progress", visibility: m(96, 240), delta: 0, open: 1 },
];

export function Gallery({ state }: { state?: string }) {
  if (state === "no-clients") return <NoClients />;
  if (state === "queue") return <Workspace view={view} team={{ ...extras, queue, openQueue: true }} />;
  return <Workspace view={view} team={extras} />;
}
