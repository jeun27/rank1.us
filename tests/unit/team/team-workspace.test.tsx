import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientSwitcher } from "@/components/workspace/ClientSwitcher";
import { ContextPane } from "@/components/workspace/ContextPane";
import { DocView } from "@/components/workspace/Docs";
import { NAV_SECTIONS } from "@/components/workspace/Sidebar";
import { TeamProvider, type TeamExtras } from "@/components/workspace/team";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";
import { buildWorkspace } from "@/lib/queries/workspace";
import { buildContextMarkdown, SECTION_LABEL, type ContextInput } from "@/lib/workspace/context";
import { exampleWorkspaceRows } from "@/app/team/example-data";

const NOW = new Date("2026-11-05T12:00:00Z");
const view = buildWorkspace(exampleWorkspaceRows());
const input: ContextInput = {
  business: { name: "Example Ramen House", city: "Irvine", state: "CA" },
  metrics: null,
  sources: null,
  fixes: { ranked: exampleFixes, tidyUps: exampleTidyUps },
  questions: [],
  checks: [],
};
const team = (over: Partial<TeamExtras> = {}): TeamExtras => ({
  businesses: [
    { id: "b1", name: "Example Ramen House" },
    { id: "b2", name: "Example Taco Stand" },
  ],
  businessId: "b1",
  formAction: "/team",
  input,
  fixes: { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false },
  loadSuggestions: vi.fn(async () => []),
  clients: null,
  actions: {
    status: vi.fn(async () => undefined),
    add: vi.fn(async () => undefined),
    dismiss: vi.fn(async () => undefined),
    invite: vi.fn(async () => ({ status: "invited" as const })),
    removeClient: vi.fn(async () => undefined),
    setFixListVisible: vi.fn(async () => undefined),
  },
  ...over,
});
const pane = (t: TeamExtras | null) =>
  render(
    <TeamProvider value={t}>
      <ContextPane
        view={view}
        section="dashboard"
        selection={{ kind: "section", section: "dashboard" }}
        now={NOW}
        onSelect={() => {}}
      />
    </TeamProvider>,
  );

afterEach(() => vi.restoreAllMocks());

describe("team workspace on real data (Step 11)", () => {
  it("nav lists only pages with real data: no Experiments, Reports or Settings", () => {
    expect(NAV_SECTIONS.map((s) => SECTION_LABEL[s])).toEqual([
      "Dashboard",
      "Questions",
      "Competitors",
      "Sources",
      "Fix list",
      "History",
    ]);
  });

  // v3 D20: the switcher moved from the context pane to the breadcrumb (tests/unit/team/client-switcher.test.tsx).
  it("the Client switcher is a GET form: select name b, labelled Client, with a Show button", () => {
    render(<ClientSwitcher team={team()} />);
    const select = screen.getByLabelText("Client");
    const form = select.closest("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/team");
    expect(select).toHaveAttribute("name", "b");
    expect(select).toHaveValue("b1");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Example Ramen House", "Example Taco Stand"]);
    expect(within(form).getByRole("button", { name: "Show" })).toHaveAttribute("type", "submit");
  });

  it("Copy context copies buildContextMarkdown for the selection; Open in Claude says paste it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    pane(team());
    await user.type(screen.getByLabelText("Prompt template"), "Draft 3 fixes.");
    await user.click(screen.getByRole("button", { name: "Copy context" }));
    expect(writeText).toHaveBeenLastCalledWith(
      buildContextMarkdown(input, { kind: "section", section: "dashboard" }, NOW, "Draft 3 fixes."),
    );
    const link = screen.getByRole("link", { name: "Open in Claude" });
    expect(link).toHaveAttribute("href", "https://claude.ai");
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(await screen.findByRole("status")).toHaveTextContent(/^Brief copied\. Paste it in Claude\.$/);
  });

  it("real data has no Example data badge; the gallery keeps it", () => {
    const { unmount } = pane(team());
    expect(screen.queryByText("Example data")).toBeNull();
    unmount();
    pane(null);
    expect(screen.getByText("Example data")).toBeInTheDocument();
  });

  it("Fix list: the shared FixList with a Status select that writes for the selected client", async () => {
    const t = team();
    render(
      <TeamProvider value={t}>
        <DocView view={view} sel={{ kind: "section", section: "fixes" }} now={NOW} onPick={() => {}} />
      </TeamProvider>,
    );
    expect(screen.getByRole("heading", { name: exampleFixes[0].title })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tidy-ups" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getAllByLabelText("Status")[0], "done");
    expect(t.actions.status).toHaveBeenCalledWith("b1", exampleFixes[0].id, "done");
  });

  it("COPY.md has the Team workspace strings and the new Open in Claude toast", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    expect(copy).toMatch(/## Team workspace \(lead, 2026-11-05\)/);
    expect(copy).toContain('"No clients yet."');
    expect(copy).toContain('"Client"');
    expect(copy).toContain('"Brief copied. Paste it in Claude."');
    expect(copy).not.toContain("Paste it in Claude if the box is empty.");
  });
});

describe("Fix list context", () => {
  it("doesn't say 'Nothing to fix yet' when the client has fixes", () => {
    render(
      <TeamProvider value={team()}>
        <ContextPane
          view={view}
          section="fixes"
          selection={{ kind: "section", section: "fixes" }}
          now={NOW}
          onSelect={() => {}}
        />
      </TeamProvider>,
    );
    expect(screen.queryByText("Nothing to fix yet. Run your first check.")).toBeNull();
  });
});

// Review on #60: Maps suggestions cost the team user's maps_lookup tokens, so they load only when
// the Competitors view opens, never on a /team load or a client switch.
describe("competitor suggestions load on demand", () => {
  const doc = (t: TeamExtras, section: "competitors" | "fixes") =>
    render(
      <TeamProvider value={t}>
        <DocView view={view} sel={{ kind: "section", section }} now={NOW} onPick={() => {}} />
      </TeamProvider>,
    );

  it("not for other sections", () => {
    const loadSuggestions = vi.fn(async () => []);
    doc(team({ loadSuggestions }), "fixes");
    expect(loadSuggestions).not.toHaveBeenCalled();
  });

  it("once, for the selected client, when Competitors opens", async () => {
    const loadSuggestions = vi.fn(async () => [{ name: "Example Pho Spot", domain: "examplepho.test", cid: "s2" }]);
    doc(team({ loadSuggestions }), "competitors");
    expect(await screen.findByText("Example Pho Spot")).toBeInTheDocument();
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
    expect(loadSuggestions).toHaveBeenCalledWith("b1");
  });
});
