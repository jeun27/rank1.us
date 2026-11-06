import { readFileSync } from "node:fs";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamConnections, type TeamConnectionsData } from "@/components/workspace/TeamConnections";
import { teamConnectionsCopy as c } from "@/components/workspace/team-connections-copy";
import { toTeamChanges } from "@/components/workspace/team-connections-data";

// C-c PR 1 (lead OK 2026-11-06, D1): the team's Connections document for one DFY client. The G3 notice
// (only here, lead Q2), one row per connection with at most one task line, the change log with values
// (team only), and notify-me interest. Read-only data; no provider calls.
const NOW = new Date("2026-11-06T12:00:00Z");
const data = (over: Partial<TeamConnectionsData> = {}): TeamConnectionsData => ({
  business: "Example Ramen House",
  gas: { readyAt: "2026-11-06T11:48:00Z", showNotice: true },
  connections: [
    { id: "g1", provider: "gbp", status: "connected", selected: [{ id: "l1", name: "Example Ramen House, Irvine" }] },
    { id: "s1", provider: "search_console", status: "needs_reauth", selected: [] },
    { id: "a1", provider: "ga4", status: "connected", selected: [] },
  ],
  changes: [
    {
      id: "x1",
      connectionId: "g1",
      field: "website_uri",
      before: "http://old.example.test",
      after: "https://exampleramen.test",
      by: null,
      at: "2026-11-05T18:00:00Z",
    },
    {
      id: "x2",
      connectionId: "g1",
      field: "description",
      before: null,
      after: "Tonkotsu since 2019.",
      by: "owner@exampleramen.test",
      at: "2026-11-04T16:30:00Z",
    },
  ],
  interest: ["yelp", "shopify"],
  ...over,
});
const setup = (over: Partial<TeamConnectionsData> = {}, dismiss = vi.fn(async () => undefined)) => {
  const onStart = vi.fn();
  render(<TeamConnections data={data(over)} now={NOW} onDismiss={dismiss} onStartFixes={onStart} />);
  return { dismiss, onStart, user: userEvent.setup() };
};

describe("TeamConnections: the G3 notice", () => {
  // Only the connected ones are named (Search Console needs reconnecting in this fixture).
  it("ready and not dismissed: the title, what connected and when, Start on the fix list, Dismiss", async () => {
    const { dismiss, onStart, user } = setup();
    const notice = screen.getByRole("region", { name: "Example Ramen House is ready for GAS" });
    expect(notice).toHaveTextContent("Google Business Profile and Google Analytics connected 12 min ago.");
    await user.click(within(notice).getByRole("button", { name: c.start }));
    expect(onStart).toHaveBeenCalled();
    await user.click(within(notice).getByRole("button", { name: c.dismiss }));
    expect(dismiss).toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: /ready for GAS/ })).toBeNull();
  });

  it("a failed Dismiss brings the notice back with the failure line", async () => {
    let fail!: (v: { error: string }) => void;
    const { user } = setup({}, vi.fn(() => new Promise<{ error: string }>((r) => (fail = r))) as never);
    await user.click(screen.getByRole("button", { name: c.dismiss }));
    await act(async () => fail({ error: "not_allowed" }));
    expect(screen.getByRole("region", { name: /ready for GAS/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(c.failed);
  });

  it.each([
    ["not ready", null],
    ["dismissed or started", { readyAt: "2026-11-06T11:48:00Z", showNotice: false }],
  ] as const)("%s: no notice", (_, gas) => {
    setup({ gas });
    expect(screen.queryByRole("region", { name: /ready for GAS/ })).toBeNull();
  });
});

describe("TeamConnections: rows, tasks, log, interest", () => {
  it("one row per connection with its status and chosen entities, and at most one task line", () => {
    setup();
    const gbp = screen.getByRole("listitem", { name: "Google Business Profile" });
    expect(gbp).toHaveTextContent("Connected");
    expect(gbp).toHaveTextContent("Example Ramen House, Irvine");
    expect(within(gbp).queryByTestId("task")).toBeNull();
    expect(
      within(screen.getByRole("listitem", { name: "Google Search Console" })).getByTestId("task"),
    ).toHaveTextContent("Ask the client to reconnect Google Search Console");
    expect(within(screen.getByRole("listitem", { name: "Google Analytics" })).getByTestId("task")).toHaveTextContent(
      "Ask the client to choose their properties",
    );
  });

  it("the change log shows the values (team only): field, before → after, who, when", () => {
    setup();
    // A stacked list, not a table: the document pane is narrow (axe: scrollable-region-focusable).
    const log = screen.getByRole("list", { name: c.changes });
    const rows = within(log).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Website");
    expect(rows[0]).toHaveTextContent("http://old.example.test");
    expect(rows[0]).toHaveTextContent("https://exampleramen.test");
    expect(rows[0]).toHaveTextContent("by Rank1 team");
    expect(rows[0]).toHaveTextContent("2026-11-05");
    expect(rows[1]).toHaveTextContent("by owner@exampleramen.test");
    expect(rows[2]).toHaveTextContent(c.byFormer);
    expect(c.byFormer).toBe("by a former user");
  });

  it("notify-me interest", () => {
    setup();
    expect(screen.getByText("Asked to hear about Yelp and Shopify")).toBeInTheDocument();
  });

  it("no connections yet: an empty list, nothing else", () => {
    setup({ connections: [], changes: [], interest: [], gas: null });
    expect(screen.queryByRole("list", { name: c.changes })).toBeNull();
  });
});

// #160 S1: attribute by who the actor is (the backend says whether each change's actor is on the team), never
// by "not a current client user": team → Rank1 team, a current client user → their email, else a former user.
describe("toTeamChanges", () => {
  const row = (id: string, actor: string) => ({
    id,
    connection_id: "g1",
    actor,
    field: "description",
    before: null,
    after: "x",
    provider_ref: null,
    created_at: "t",
  });
  it("team, a current client user, and a former user", () => {
    const rows = toTeamChanges(
      [row("1", "u-team"), row("2", "u-client"), row("3", "u-gone")],
      [{ user_id: "u-client", email: "owner@exampleramen.test" }],
      new Set(["1"]),
    );
    expect(rows.map((r) => r.by)).toEqual([
      { kind: "team" },
      { kind: "client", email: "owner@exampleramen.test" },
      { kind: "former" },
    ]);
  });

  it("a team actor who is also listed as a client user still reads as the Rank1 team", () => {
    const rows = toTeamChanges([row("1", "u-x")], [{ user_id: "u-x", email: "x@example.test" }], new Set(["1"]));
    expect(rows[0].by).toEqual({ kind: "team" });
  });
});

describe("copy", () => {
  it("every C-c PR 1 string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [c.start, c.dismiss, c.byTeam, c.byFormer]) expect(copy, s).toContain(`"${s}"`);
    for (const s of [
      '"{Business} is ready for GAS"',
      '"{connections} connected {age} ago."',
      '"Ask the client to reconnect {connection}"',
      '"Ask the client to choose their {locations|sites|properties}"',
      '"Asked to hear about {connectors}"',
      '"by {name}"',
    ])
      expect(copy, s).toContain(s);
  });
});

// The document opens from the client switcher, beside Clients, only when the team has Connections (the flag).
describe("ClientSwitcher: Connections", () => {
  const team = {
    businesses: [{ id: "b1", name: "Example Ramen House" }],
    businessId: "b1",
    formAction: "/team",
  };
  it("a Connections row opens the document", async () => {
    const { ClientSwitcher } = await import("@/components/workspace/ClientSwitcher");
    const onConnections = vi.fn();
    const user = userEvent.setup();
    render(<ClientSwitcher team={team} onClients={vi.fn()} onConnections={onConnections} />);
    await user.click(screen.getByRole("button", { name: "Client Example Ramen House" }));
    await user.click(screen.getByRole("button", { name: c.title }));
    expect(onConnections).toHaveBeenCalled();
  });

  it("no Connections (flag off): no row", async () => {
    const { ClientSwitcher } = await import("@/components/workspace/ClientSwitcher");
    const user = userEvent.setup();
    render(<ClientSwitcher team={team} onClients={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Client Example Ramen House" }));
    expect(screen.queryByRole("button", { name: c.title })).toBeNull();
  });
});
