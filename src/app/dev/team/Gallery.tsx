"use client";
import { exampleSuggestions } from "@/components/app/example-data";
import { exampleDone, exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
import { exampleMentions } from "@/components/mentions/example-data";
import { exampleNarrative } from "@/components/narrative/example-data";
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
  // C-c: the Connections document on Example data (the G3 notice shows; Search Console needs reconnecting).
  connections: {
    business: view.business.name,
    gas: { readyAt: "2026-11-05T11:48:00Z", showNotice: true },
    connections: [
      {
        id: "ex-gbp",
        provider: "gbp",
        status: "connected",
        selected: [{ id: "l1", name: "Example Ramen House, Irvine" }],
      },
      { id: "ex-sc", provider: "search_console", status: "needs_reauth", selected: [] },
      { id: "ex-ga4", provider: "ga4", status: "connected", selected: [] },
    ],
    changes: [
      {
        id: "ex-c1",
        connectionId: "ex-gbp",
        field: "website_uri",
        before: "http://old.exampleramen.test",
        after: "https://exampleramen.test",
        by: { kind: "team" },
        at: "2026-11-04T18:00:00Z",
      },
      {
        id: "ex-c2",
        connectionId: "ex-gbp",
        field: "description",
        before: "Ramen in Irvine.",
        after: "Tonkotsu ramen near Diamond Jamboree, open late on weekends.",
        by: { kind: "client", email: "owner@exampleramen.test" },
        at: "2026-11-02T16:30:00Z",
      },
      {
        id: "ex-c3",
        connectionId: "ex-gbp",
        field: "primary_phone",
        before: "(949) 555-0100",
        after: "(949) 555-0199",
        by: { kind: "former" },
        at: "2026-10-28T10:00:00Z",
      },
    ],
    interest: ["yelp"],
  },
  narrative: exampleNarrative,
  mentions: { targets: exampleMentions, fixId: "ex-r17" },
  actions: {
    status: noop,
    add: noop,
    dismiss: noop,
    invite: async (_b: string, email: string) =>
      ({ status: email.includes("@") ? "invited" : "invalid_email" }) as const,
    removeClient: noop,
    setFixListVisible: noop,
    dismissReady: noop,
    saveNarrative: async () => ({ ok: true }),
    decideMention: async () => ({ fixId: "ex-r17" }),
    // C-c PR 2 on Example data: the preview diffs against an invented "before"; apply does nothing.
    previewGbp: async (_b: string, _l: string, edit: Record<string, string | undefined>) => ({
      changes: Object.entries(edit).map(([field, after]) => ({
        field,
        before: "Example data: the current value",
        after,
      })),
    }),
    applyGbp: async () => ({ applied: 1 }),
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
