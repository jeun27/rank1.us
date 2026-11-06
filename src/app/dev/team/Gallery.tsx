"use client";
import { exampleSuggestions } from "@/components/app/example-data";
import { exampleDone, exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";
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
    ],
    interest: ["yelp"],
  },
  actions: {
    status: noop,
    add: noop,
    dismiss: noop,
    invite: async (_b: string, email: string) =>
      ({ status: email.includes("@") ? "invited" : "invalid_email" }) as const,
    removeClient: noop,
    setFixListVisible: noop,
    dismissReady: noop,
  },
};

export function Gallery({ state }: { state?: string }) {
  if (state === "no-clients") return <NoClients />;
  return <Workspace view={view} team={extras} />;
}
