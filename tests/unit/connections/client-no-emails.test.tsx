import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionsHub } from "@/components/connections/ConnectionsHub";
import { exampleConnected, exampleHub } from "@/components/connections/example-data";

// #160 (lead): emails show only in the team's log. The client's hub (/client/settings/connections) never shows
// another user's email: its change log carries the field and when only (HubChange has no actor).
describe("the client's hub", () => {
  it("renders the change log with no email and no actor", () => {
    render(<ConnectionsHub {...exampleHub({ ...exampleConnected, returnTo: "/client/settings/connections" })} />);
    expect(screen.getByRole("list", { name: "Changes" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it("loadHub hands the hub only id, connection, field and when for each change", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
    vi.doMock("@/components/youtube/load", () => ({ cuisineOf: async () => "ramen" }));
    vi.doMock("@/lib/queries/connections", async (actual) => ({
      ...(await actual<object>()),
      getBusinessVertical: async () => "restaurant",
      listConnections: async () => [],
      listConnectorInterest: async () => [],
      canConnectBusiness: async () => true,
      listConnectionChanges: async () => [
        {
          id: "c1",
          connection_id: "g1",
          actor: "u-other",
          field: "description",
          before: "old",
          after: "new",
          provider_ref: null,
          created_at: "2026-11-05T10:00:00Z",
        },
      ],
    }));
    const { loadHub } = await import("@/components/connections/load");
    const hub = await loadHub({} as never, "b1", "/client/settings/connections", {});
    expect(hub.changes).toEqual([{ id: "c1", connectionId: "g1", field: "description", at: "2026-11-05T10:00:00Z" }]);
  });
});
