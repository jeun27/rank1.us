import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionsHub, type HubProps } from "@/components/connections/ConnectionsHub";
import { connectionsCopy as c } from "@/components/connections/copy";
import { GOOGLE_SCOPES } from "@/lib/connections/oauth";
import { recommend, type Industry } from "@/lib/connections/recommend";
import { GBP_EDIT_FIELDS } from "@/lib/queries/connections";
import { connectionsTarget } from "@/lib/supabase/middleware";

// Connections C-a (lead OK 2026-11-06): Settings → Connections behind ENABLE_CONNECTIONS. Tiles come from the
// ONE recommend() table; only gbp, search_console and ga4 connect; everything else is Coming soon + Notify me.
const actions = () => ({
  revoke: vi.fn(async () => undefined),
  notify: vi.fn(async () => undefined),
  entities: vi.fn(async () => [
    { id: "locations/1", name: "Example Ramen House, Irvine" },
    { id: "locations/2", name: "Example Ramen House, Tustin" },
  ]),
  pick: vi.fn(async () => undefined),
});
const hub = (over: Partial<HubProps> = {}) => {
  const a = actions();
  const props: HubProps = {
    businessId: "b1",
    industry: "restaurant",
    connections: [],
    interest: [],
    changes: [],
    canConnect: true,
    returnTo: "/app/settings/connections",
    outcome: null,
    actions: a,
    ...over,
  };
  render(<ConnectionsHub {...props} />);
  return { a: (over.actions as ReturnType<typeof actions>) ?? a, user: userEvent.setup() };
};
const tile = (name: string) => screen.getByRole("article", { name });
const section = (name: string) => screen.queryByRole("region", { name });

describe("tiles by industry (one recommend() table)", () => {
  it.each(["restaurant", "saas", "dtc", "hvac", "other"] as Industry[])(
    "%s: the tiers and tiles follow recommend()",
    (industry) => {
      hub({ industry });
      const r = recommend(industry);
      for (const tier of ["recommended", "optional", "later"] as const) {
        const region = section(c.tiers[tier]);
        if (!r[tier].length) {
          expect(region, tier).toBeNull();
          continue;
        }
        expect(
          within(region!)
            .getAllByRole("article")
            .map((a) => a.getAttribute("aria-label")),
        ).toEqual(r[tier].map((t) => c.names[t.connector]));
        // Each tile carries its own niche helper text (two tiles can share one).
        for (const t of r[tier])
          expect(
            within(within(region!).getByRole("article", { name: c.names[t.connector] })).getByText(c.niches[t.niche]),
          ).toBeInTheDocument();
      }
    },
  );

  it("a restaurant gets Business Profile recommended, booking tools optional, no Shopify or G2", () => {
    hub({ industry: "restaurant" });
    expect(within(section(c.tiers.recommended)!).getByRole("article", { name: c.names.gbp })).toBeInTheDocument();
    expect(within(section(c.tiers.optional)!).getByRole("article", { name: c.names.opentable })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: c.names.shopify })).toBeNull();
    expect(screen.queryByRole("article", { name: c.names.g2_capterra })).toBeNull();
  });

  it("'other' (incl. med-spa) has no Recommended tier but can still connect the live Google tiles", () => {
    hub({ industry: "other" });
    expect(section(c.tiers.recommended)).toBeNull();
    expect(within(tile(c.names.gbp)).getByRole("button", { name: c.connect })).toBeInTheDocument();
  });
});

describe("live tiles: consent, then Google", () => {
  it.each(["gbp", "search_console", "ga4"] as const)(
    "%s: Connect opens the consent sheet; Continue goes to the start route",
    async (k) => {
      const { user } = hub({ industry: "other" });
      await user.click(within(tile(c.names[k])).getByRole("button", { name: c.connect }));
      const dialog = screen.getByRole("dialog", { name: c.names[k] });
      for (const line of c.consent[k]) expect(dialog).toHaveTextContent(line);
      expect(within(dialog).getByRole("link", { name: c.continue })).toHaveAttribute(
        "href",
        `/api/connections/google/start?business=b1&connector=${k}&return=${encodeURIComponent("/app/settings/connections")}`,
      );
      await user.click(within(dialog).getByRole("button", { name: c.cancel }));
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("the consent text states exactly what the code does: the scope, the GBP fields, review + log, revoke, no passwords", () => {
    const text = (k: keyof typeof c.consent) => c.consent[k].join(" ");
    const scope = (k: keyof typeof GOOGLE_SCOPES) => GOOGLE_SCOPES[k].split("/").at(-1)!;
    for (const k of ["gbp", "search_console", "ga4"] as const) {
      expect(text(k)).toContain(scope(k));
      expect(text(k)).toMatch(/password/);
      expect(text(k)).toMatch(/myaccount\.google\.com\/permissions/);
      expect(text(k)).toContain(c.disconnect);
    }
    for (const f of GBP_EDIT_FIELDS) expect(text("gbp").toLowerCase()).toContain(c.fields[f].toLowerCase());
    expect(text("gbp")).toMatch(/shown before it's applied/);
    expect(text("gbp")).toMatch(/logged/);
    for (const k of ["search_console", "ga4"] as const) expect(text(k)).toMatch(/read-only/i);
  });
});

describe("connection states", () => {
  const gbp = (
    status: "connected" | "needs_reauth" | "revoked",
    selected = [{ id: "locations/1", name: "Example Ramen House, Irvine" }],
  ) => ({
    id: "c1",
    provider: "gbp" as const,
    status,
    selected,
  });

  it("connected: the status, the chosen locations, Choose locations and Disconnect", () => {
    hub({ connections: [gbp("connected")] });
    const t = tile(c.names.gbp);
    expect(within(t).getByTestId("status")).toHaveTextContent(c.statuses.connected);
    expect(within(t).getByText("Example Ramen House, Irvine")).toBeInTheDocument();
    expect(within(t).getByRole("button", { name: c.pick.gbp })).toBeInTheDocument();
    expect(within(t).getByRole("button", { name: c.disconnect })).toBeInTheDocument();
    expect(within(t).queryByRole("button", { name: c.connect })).toBeNull();
  });

  it("needs reauth: Reconnect opens the same consent sheet", async () => {
    const { user } = hub({ connections: [gbp("needs_reauth")] });
    const t = tile(c.names.gbp);
    expect(within(t).getByTestId("status")).toHaveTextContent(c.statuses.needs_reauth);
    await user.click(within(t).getByRole("button", { name: c.reconnect }));
    expect(screen.getByRole("dialog", { name: c.names.gbp })).toBeInTheDocument();
  });

  it("revoked: shown as Revoked, and Connect starts again", () => {
    hub({ connections: [gbp("revoked")] });
    const t = tile(c.names.gbp);
    expect(within(t).getByTestId("status")).toHaveTextContent(c.statuses.revoked);
    expect(within(t).getByRole("button", { name: c.connect })).toBeInTheDocument();
    expect(within(t).queryByRole("button", { name: c.disconnect })).toBeNull();
  });

  it("Disconnect asks first, with the one-grant warning, then revokes", async () => {
    const { a, user } = hub({ connections: [gbp("connected")] });
    await user.click(within(tile(c.names.gbp)).getByRole("button", { name: c.disconnect }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("This also disconnects Search Console and Analytics");
    expect(a.revoke).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: c.disconnect }));
    expect(a.revoke).toHaveBeenCalledWith("c1");
  });

  it("the picker: loads the locations, the chosen ones ticked, Save sends the ids", async () => {
    const { a, user } = hub({ connections: [gbp("connected")] });
    await user.click(within(tile(c.names.gbp)).getByRole("button", { name: c.pick.gbp }));
    const group = await screen.findByRole("group", { name: c.pick.gbp });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false]);
    await user.click(within(group).getByRole("checkbox", { name: "Example Ramen House, Tustin" }));
    await user.click(within(group.closest("form")!).getByRole("button", { name: c.save }));
    expect(a.pick).toHaveBeenCalledWith("c1", ["locations/1", "locations/2"]);
  });

  it("a failed picker load or revoke shows the error banner, not a silent no-op", async () => {
    const a = { ...actions(), entities: vi.fn(async () => ({ error: "needs_reauth" })) };
    const { user } = hub({ connections: [gbp("connected")], actions: a });
    await user.click(within(tile(c.names.gbp)).getByRole("button", { name: c.pick.gbp }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.failed);
  });

  it("the change log shows the field and when (no values for clients)", () => {
    hub({
      connections: [gbp("connected")],
      changes: [{ id: "x1", connectionId: "c1", field: "regular_hours", at: "2026-11-05T18:00:00Z" }],
    });
    const log = within(tile(c.names.gbp)).getByRole("list", { name: c.changes });
    expect(log).toHaveTextContent(c.fields.regular_hours);
    expect(log).toHaveTextContent("2026-11-05");
  });
});

describe("Coming soon tiles", () => {
  it("no Connect button; Notify me stores interest, then says so", async () => {
    const { a, user } = hub({ industry: "restaurant" });
    const t = tile(c.names.yelp);
    expect(within(t).getByText(c.comingSoon)).toBeInTheDocument();
    expect(within(t).queryByRole("button", { name: c.connect })).toBeNull();
    await user.click(within(t).getByRole("button", { name: c.notify }));
    expect(a.notify).toHaveBeenCalledWith("yelp");
    expect(within(t).getByRole("status")).toHaveTextContent(c.noted);
    expect(within(t).queryByRole("button", { name: c.notify })).toBeNull();
  });

  it("already noted: says so, with no button", () => {
    hub({ industry: "restaurant", interest: ["yelp"] });
    expect(within(tile(c.names.yelp)).getByText(c.noted)).toBeInTheDocument();
    expect(within(tile(c.names.yelp)).queryByRole("button", { name: c.notify })).toBeNull();
  });
});

describe("the callback outcome and read-only viewers", () => {
  it.each([
    ["connected", "info"],
    ["denied", "info"],
    ["error", "error"],
    ["not_allowed", "error"],
  ] as const)("?status=%s shows its banner", (status, tone) => {
    hub({ outcome: { connector: "gbp", status } });
    const banner = screen.getByRole(tone === "error" ? "alert" : "status");
    expect(banner).toHaveTextContent(
      status === "connected"
        ? c.outcomes.connected(c.names.gbp)
        : status === "denied"
          ? c.outcomes.denied
          : c.outcomes.error,
    );
  });

  it("without canConnect: statuses only, no Connect / Disconnect / Notify me", () => {
    hub({ canConnect: false, connections: [{ id: "c1", provider: "gbp", status: "connected", selected: [] }] });
    expect(screen.queryByRole("button", { name: c.connect })).toBeNull();
    expect(screen.queryByRole("button", { name: c.disconnect })).toBeNull();
    expect(screen.queryByRole("button", { name: c.notify })).toBeNull();
    expect(within(tile(c.names.gbp)).getByTestId("status")).toHaveTextContent(c.statuses.connected);
  });
});

describe("the ENABLE_CONNECTIONS gate (proxy, a real 404 before the page streams)", () => {
  it("matches the settings and connections pages in /app and /client, on the normalized path", () => {
    for (const p of [
      "/app/settings",
      "/app/settings/connections",
      "/client/settings/connections",
      "/APP/settings/",
      "//app/./settings/connections",
    ])
      expect(connectionsTarget(p), p).toBe(true);
    for (const p of ["/app", "/app/settingsx", "/app/settings/connections/x", "/team/settings", "/client"])
      expect(connectionsTarget(p), p).toBe(false);
  });
});

describe("copy (DRAFT, lead to sign off)", () => {
  it("COPY.md's 'Connections (lead, 2026-11-06)' section has every string the hub shows", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    const at = copy.indexOf("## Connections (lead, 2026-11-06)");
    const section = copy.slice(at, copy.indexOf("\n## ", at + 5));
    const strings = [
      c.title,
      ...Object.values(c.names),
      ...Object.values(c.tiers),
      ...Object.values(c.statuses),
      ...Object.values(c.pick),
      ...Object.values(c.fields),
      ...Object.values(c.consent).flat(),
      c.comingSoon,
      c.connect,
      c.reconnect,
      c.disconnect,
      c.notify,
      c.noted,
      c.continue,
      c.cancel,
      c.save,
      c.changes,
      c.failed,
      c.outcomes.denied,
      c.outcomes.error,
    ];
    for (const s of strings) expect(section, s).toContain(`"${s}"`);
    expect(section).toContain('"{connector} is connected."');
    for (const s of Object.values(c.niches)) expect(copy).toContain(`"${s}"`);
  });
});

describe("one primary per screen (UI.md)", () => {
  it("only a Recommended tile's Connect is the filled button", () => {
    hub({ industry: "restaurant" });
    const gbp = within(tile(c.names.gbp)).getByRole("button", { name: c.connect });
    const sc = within(tile(c.names.search_console)).getByRole("button", { name: c.connect });
    expect(gbp.className).toContain("bg-accent");
    expect(sc.className).not.toContain("bg-accent");
  });
});
