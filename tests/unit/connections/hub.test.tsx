import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionsHub, type HubProps } from "@/components/connections/ConnectionsHub";
import { connectionsCopy as c } from "@/components/connections/copy";
import { GOOGLE_SCOPES, startAuth } from "@/lib/connections/oauth";
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
      const soon = [...r.recommended, ...r.optional, ...r.later].filter((t) => t.available === "coming_soon");
      for (const tier of ["recommended", "optional"] as const)
        if (!r[tier].some((t) => t.available === "live")) expect(section(c.tiers[tier]), tier).toBeNull();
      if (soon.length)
        expect(
          within(section(c.tiers.later)!).getByText(soon.map((t) => c.names[t.connector]).join(" · ")),
        ).toBeInTheDocument();
      const cards = screen.queryAllByRole("article").map((a) => a.getAttribute("aria-label"));
      for (const t of soon) expect(cards, t.connector).not.toContain(c.names[t.connector]);
      for (const tier of ["recommended", "optional", "later"] as const) {
        const region = section(c.tiers[tier]);
        if (!r[tier].length) continue;
        // X12: live tiles stay as cards; every Coming soon tile (any tier) folds into the one Coming soon line.
        const live = r[tier].filter((t) => t.available === "live");
        if (tier === "later" || !live.length) continue;
        expect(
          within(region!)
            .getAllByRole("article")
            .map((a) => a.getAttribute("aria-label")),
        ).toEqual(live.map((t) => c.names[t.connector]));
        // Each tile carries its own niche helper text (two tiles can share one).
        for (const t of live)
          expect(
            within(within(region!).getByRole("article", { name: c.names[t.connector] })).getByText(c.niches[t.niche]),
          ).toBeInTheDocument();
      }
    },
  );

  it("a restaurant gets Business Profile recommended, booking tools optional, no Shopify or G2", () => {
    hub({ industry: "restaurant" });
    expect(within(section(c.tiers.recommended)!).getByRole("article", { name: c.names.gbp })).toBeInTheDocument();
    // OpenTable has no live flow yet, so it sits in the one Coming soon line (X12).
    expect(within(section(c.tiers.later)!).getByText(new RegExp(c.names.opentable))).toBeInTheDocument();
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
  // G1: YouTube is live too (read-only).
  it.each(["gbp", "search_console", "ga4", "youtube"] as const)(
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

  // Lead sign-off (2026-11-06): the first line names everything the auth URL asks for (openid + the scope),
  // in plain words with the scope name in parentheses. Read from the real startAuth URL, not a copy of it.
  it("the first consent line covers every scope the auth URL requests: the connector's scope and openid", () => {
    const env = { GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y", NEXT_PUBLIC_SITE_URL: "https://rank1.example" };
    for (const k of ["gbp", "search_console", "ga4", "youtube"] as const) {
      const asked = new URL(startAuth(k, "b1", env).url).searchParams.get("scope")!.split(" ");
      expect(asked.sort()).toEqual(["openid", GOOGLE_SCOPES[k]].sort());
      const first = c.consent[k][0];
      expect(first).toContain(`(${GOOGLE_SCOPES[k].split("/").at(-1)})`);
      // openid: the account sub only.
      expect(first).toContain("to know which Google account you used. We don't get your email or profile.");
      expect(c.consent[k].join(" ")).not.toMatch(/one permission/i);
    }
  });

  it("the rest states what the code does: the GBP fields after a confirm, review + log, revoke, no passwords", () => {
    const text = (k: keyof typeof c.consent) => c.consent[k].join(" ");
    for (const k of ["gbp", "search_console", "ga4", "youtube"] as const) {
      expect(text(k)).toMatch(/password/);
      expect(text(k)).toMatch(/myaccount\.google\.com\/permissions/);
      expect(text(k)).toContain(c.disconnect);
    }
    expect(c.consent.gbp[1]).toBe(
      "We only change these fields, and only after you or the Rank1 team confirm: description, hours, special hours, website, primary phone and attributes.",
    );
    for (const f of GBP_EDIT_FIELDS) expect(c.consent.gbp[1].toLowerCase()).toContain(c.fields[f].toLowerCase());
    expect(text("gbp")).toMatch(/shown before it's applied/);
    expect(text("gbp")).toMatch(/logged/);
    for (const k of ["search_console", "ga4", "youtube"] as const) expect(text(k)).toMatch(/read-only/i);
  });
});

describe("plain-word statuses (lead sign-off), the code enums unchanged", () => {
  it("Connected / Needs reconnect / Disconnected", () => {
    expect(c.statuses).toEqual({ connected: "Connected", needs_reauth: "Needs reconnect", revoked: "Disconnected" });
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
    // G1 (lead): the grant is shared, so Disconnect names every Google service.
    expect(dialog).toHaveTextContent(
      "This disconnects every Google service Rank1 uses: Business Profile, Search Console, Analytics and YouTube.",
    );
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

// X12 (lead OK, item 22): every Coming soon connector folds into one line under "Coming soon", with one
// "Notify me" for all of them (no tile per connector).
describe("Coming soon, collapsed to one line", () => {
  it("one line of names, no Connect, and one Notify me that registers each, then says so", async () => {
    const { a, user } = hub({ industry: "restaurant" });
    const region = section(c.tiers.later)!;
    expect(within(region).queryAllByRole("article")).toHaveLength(0);
    expect(within(region).getByText(new RegExp(c.names.yelp))).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: c.connect })).toBeNull();
    const notify = within(region).getAllByRole("button", { name: c.notify });
    expect(notify).toHaveLength(1);
    await user.click(notify[0]);
    const soon = Object.values(recommend("restaurant"))
      .flat()
      .filter((t) => t.available === "coming_soon")
      .map((t) => t.connector);
    expect(a.notify.mock.calls.map((x) => (x as unknown[])[0]).sort()).toEqual([...soon].sort());
    expect(within(region).getByRole("status")).toHaveTextContent(c.noted);
    expect(within(region).queryByRole("button", { name: c.notify })).toBeNull();
  });

  it("some already noted: Notify me registers only the rest", async () => {
    const { a, user } = hub({ industry: "restaurant", interest: ["yelp"] });
    await user.click(within(section(c.tiers.later)!).getByRole("button", { name: c.notify }));
    expect(a.notify.mock.calls.map((x) => (x as unknown[])[0])).not.toContain("yelp");
  });

  // #196 review: a retry after a partly failed Notify me sends only the connectors that failed.
  it("a retry after a partial failure re-sends only the ones that failed", async () => {
    const { a, user } = hub({ industry: "restaurant" });
    const soon = Object.values(recommend("restaurant"))
      .flat()
      .filter((t) => t.available === "coming_soon")
      .map((t) => t.connector);
    const [failing] = soon;
    const notify = a.notify as unknown as ReturnType<typeof vi.fn>;
    notify.mockImplementation(async (k: unknown) => (k === failing ? { error: "failed" } : undefined));
    await user.click(within(section(c.tiers.later)!).getByRole("button", { name: c.notify }));
    expect(within(section(c.tiers.later)!).queryByText(c.noted)).toBeNull();
    notify.mockClear();
    notify.mockImplementation(async () => undefined);
    await user.click(within(section(c.tiers.later)!).getByRole("button", { name: c.notify }));
    expect(a.notify.mock.calls.map((x) => (x as unknown[])[0])).toEqual([failing]);
    expect(within(section(c.tiers.later)!).getByRole("status")).toHaveTextContent(c.noted);
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
      // C-b: the onboarding connect step.
      "/app/onboarding/connect",
      "/APP/settings/",
      "//app/./settings/connections",
    ])
      expect(connectionsTarget(p), p).toBe(true);
    for (const p of [
      "/app",
      "/app/onboarding",
      "/app/settingsx",
      "/app/settings/connections/x",
      "/team/settings",
      "/client",
    ])
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

// X30: one filled button. Only the next unconnected Recommended tile's Connect is filled; with a connection
// needing a reconnect, the banner's Reconnect is the one primary instead.
describe("one primary per screen (UI.md, X30)", () => {
  const filled = () => screen.queryAllByRole("button").filter((b) => b.className.includes("bg-accent"));

  it("the next unconnected Recommended Connect is the only filled button", () => {
    hub({ industry: "restaurant" });
    expect(filled()).toEqual([within(tile(c.names.gbp)).getByRole("button", { name: c.connect })]);
  });

  it("with the Recommended ones connected, nothing is filled (Optional stays secondary)", () => {
    hub({ industry: "restaurant", connections: [{ id: "c1", provider: "gbp", status: "connected", selected: [] }] });
    expect(filled()).toEqual([]);
  });

  it("a connection that needs a reconnect: a warn banner first, whose Reconnect is the one primary", async () => {
    const { user } = hub({
      industry: "restaurant",
      connections: [{ id: "c1", provider: "gbp", status: "needs_reauth", selected: [] }],
    });
    const banner = screen.getAllByRole("status")[0];
    expect(banner).toHaveTextContent(`${c.names.gbp}: ${c.statuses.needs_reauth}`);
    expect(banner.className).toContain("bg-warnBg");
    expect(
      banner.compareDocumentPosition(section(c.tiers.recommended)!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const reconnect = within(banner).getByRole("button", { name: c.reconnect });
    expect(filled()).toEqual([reconnect]);
    await user.click(reconnect);
    expect(screen.getByRole("dialog", { name: c.names.gbp })).toBeInTheDocument();
  });

  it("read-only viewers see the banner without a button", () => {
    hub({ canConnect: false, connections: [{ id: "c1", provider: "gbp", status: "needs_reauth", selected: [] }] });
    const banner = screen.getAllByRole("status")[0];
    expect(banner).toHaveTextContent(`${c.names.gbp}: ${c.statuses.needs_reauth}`);
    expect(within(banner).queryByRole("button")).toBeNull();
  });
});

// X30 + backend's entity_count (#183): "Choose …" only when the account offers more than one; unknown (null,
// the list was never loaded) still offers it, since loading the list is what records the count.
describe("Choose … follows the entity count", () => {
  it.each([
    [null, true],
    [2, true],
    [1, false],
    [0, false],
  ] as const)("entity count %s → Choose locations shown: %s", (entityCount, shown) => {
    hub({ connections: [{ id: "c1", provider: "gbp", status: "connected", selected: [], entityCount }] });
    expect(Boolean(within(tile(c.names.gbp)).queryByRole("button", { name: c.pick.gbp }))).toBe(shown);
  });
});

// G1 (lead Q3): the YouTube tile shows status only, "Connected · {n} videos checked"; the checklist itself is
// the evidence on the P4 fixes. The picker reads "Choose channel".
describe("the YouTube tile", () => {
  const yt = { id: "y1", provider: "youtube" as const, status: "connected" as const, selected: [] };
  // #150 review: no live read, and nothing stores a "videos checked" count, so the tile shows the status only.
  it("connected: Connected, Choose channel and Disconnect", () => {
    hub({ industry: "other", connections: [yt] });
    const t = tile(c.names.youtube);
    expect(within(t).getByTestId("status")).toHaveTextContent(c.statuses.connected);
    expect(t).not.toHaveTextContent("videos checked");
    expect(within(t).getByRole("button", { name: c.pick.youtube })).toBeInTheDocument();
    expect(c.pick.youtube).toBe("Choose channel");
  });

  // No keyword (cuisine null): no R19–R21 fixes exist, so the checklist never shows; the tile says it instead.
  it("connected, no keyword: the tile adds the plain no-keyword line", () => {
    hub({ industry: "other", connections: [yt], youtubeNoKeyword: true });
    expect(tile(c.names.youtube)).toHaveTextContent("Add your main keyword to check your videos.");
  });
});
