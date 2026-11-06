import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConnectCard } from "@/components/connections/ConnectCard";
import { connectionsCopy as c } from "@/components/connections/copy";
import { appCopy } from "@/components/app/copy";

// C-b (lead OK 2026-11-06): "Connect your accounts" until every Recommended connection is connected,
// then "You're all set" (copy per audience, lead Q1). Connect opens the same consent sheet as the hub.
const base = { businessId: "example-business", returnTo: "/app", canConnect: true, audience: "self" as const };

describe("ConnectCard: connect", () => {
  it("shows n of m, a progress bar and Connect, which opens the consent sheet back to returnTo", async () => {
    const user = userEvent.setup();
    render(<ConnectCard {...base} state={{ kind: "connect", rows: [{ connector: "gbp", status: "missing" }] }} />);
    const card = screen.getByRole("region", { name: c.card.title });
    expect(within(card).getByText(c.card.intro)).toBeInTheDocument();
    expect(within(card).getByText(c.card.count(0, 1))).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: c.card.count(0, 1) })).toHaveAttribute("aria-valuenow", "0");
    await user.click(within(card).getByRole("button", { name: `${c.connect} ${c.names.gbp}` }));
    const dialog = screen.getByRole("dialog", { name: c.names.gbp });
    expect(within(dialog).getByRole("link", { name: c.continue })).toHaveAttribute(
      "href",
      "/api/connections/google/start?business=example-business&connector=gbp&return=%2Fapp",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a connected row shows its status; a needs-reauth row offers Reconnect", () => {
    render(
      <ConnectCard
        {...base}
        state={{
          kind: "connect",
          rows: [
            { connector: "gbp", status: "connected" },
            { connector: "search_console", status: "needs_reauth" },
          ],
        }}
      />,
    );
    expect(screen.getByText(c.card.count(1, 2))).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: c.names.gbp })).toHaveTextContent(c.statuses.connected);
    expect(
      within(screen.getByRole("listitem", { name: c.names.search_console })).getByRole("button", {
        name: `${c.reconnect} ${c.names.search_console}`,
      }),
    ).toBeInTheDocument();
  });

  it("read-only viewers see the statuses and no buttons", () => {
    render(
      <ConnectCard
        {...base}
        canConnect={false}
        state={{
          kind: "connect",
          rows: [
            { connector: "gbp", status: "missing" },
            { connector: "search_console", status: "needs_reauth" },
          ],
        }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("listitem", { name: c.names.search_console })).toHaveTextContent(c.statuses.needs_reauth);
  });

  it("on the onboarding step: Skip for now goes to the dashboard", () => {
    render(
      <ConnectCard
        {...base}
        skipHref="/app"
        state={{ kind: "connect", rows: [{ connector: "gbp", status: "missing" }] }}
      />,
    );
    expect(screen.getByRole("link", { name: c.card.skip })).toHaveAttribute("href", "/app");
  });
});

describe("ConnectCard: you're all set", () => {
  it("self-serve: just what is connected (review: nothing reads connections yet), and links to the fix list", () => {
    render(<ConnectCard {...base} fixesHref="/app/fixes" state={{ kind: "ready", connectors: ["gbp"] }} />);
    const card = screen.getByRole("region", { name: c.card.readyTitle });
    expect(card).toHaveTextContent(c.card.readyBody("self", [c.names.gbp]));
    expect(c.card.readyBody("self", [c.names.gbp])).toBe("Google Business Profile is connected.");
    expect(within(card).getByRole("link", { name: appCopy.fixNext })).toHaveAttribute("href", "/app/fixes");
    expect(within(card).queryByRole("progressbar")).toBeNull();
  });

  it("DFY: the team takes it from here, no timing promised (lead Q1)", () => {
    render(<ConnectCard {...base} audience="dfy" state={{ kind: "ready", connectors: ["gbp", "search_console"] }} />);
    expect(screen.getByRole("region", { name: c.card.readyTitle })).toHaveTextContent(
      "Google Business Profile and Google Search Console are connected. The Rank1 team takes it from here, and every change shows under Changes.",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("on the onboarding step: Go to your dashboard", () => {
    render(<ConnectCard {...base} skipHref="/app" state={{ kind: "ready", connectors: ["gbp"] }} />);
    expect(screen.getByRole("link", { name: c.card.toDashboard })).toHaveAttribute("href", "/app");
  });
});

describe("copy", () => {
  it("every C-b string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      c.card.title,
      c.card.intro,
      c.card.skip,
      c.card.toDashboard,
      c.card.readyTitle,
      c.card.industry,
      ...Object.values(c.card.verticals),
    ])
      expect(copy, s).toContain(`"${s}"`);
    for (const s of [
      '"{n} of {m} connected"',
      '"{names} are connected."',
      '"{names} are connected. The Rank1 team takes it from here, and every change shows under Changes."',
    ])
      expect(copy, s).toContain(s);
  });
});
