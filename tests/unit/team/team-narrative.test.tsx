import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClientSwitcher } from "@/components/workspace/ClientSwitcher";
import { DocView } from "@/components/workspace/Docs";
import { TeamProvider, type TeamExtras } from "@/components/workspace/team";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";
import { exampleNarrative } from "@/components/narrative/example-data";
import { narrativeCopy as c } from "@/components/narrative/copy";
import { buildWorkspace } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";

// C-c PR 3 (D3, lead Q6 O1 2026-11-06): the team sets a DFY client's narrative words from a client switcher
// row beside Connections. The row and the document read "How AI describes {Business}" (in the team view
// "you" would mean the team); the editor's own labels stay the client's ("Words that fit you"). Saves go
// through a team action that takes the business id. Behind ENABLE_NARRATIVE (narrative null).
const NOW = new Date("2026-11-05T12:00:00Z");
const view = buildWorkspace(exampleWorkspaceRows());
type Save = NonNullable<TeamExtras["actions"]["saveNarrative"]>;
const team = (over: Partial<TeamExtras> = {}, save: Save = vi.fn(async () => ({ ok: true as const }))): TeamExtras => ({
  businesses: [{ id: "b1", name: "Example Ramen House" }],
  businessId: "b1",
  formAction: "/team",
  input: null,
  fixes: { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false },
  loadSuggestions: vi.fn(async () => []),
  clients: null,
  narrative: exampleNarrative,
  actions: {
    status: vi.fn(async () => undefined),
    add: vi.fn(async () => undefined),
    dismiss: vi.fn(async () => undefined),
    invite: vi.fn(async () => ({ status: "invited" as const })),
    removeClient: vi.fn(async () => undefined),
    setFixListVisible: vi.fn(async () => undefined),
    saveNarrative: save,
  },
  ...over,
});
const doc = (t: TeamExtras) =>
  render(
    <TeamProvider value={t}>
      <DocView view={view} sel={{ kind: "narrative" }} now={NOW} onPick={vi.fn()} />
    </TeamProvider>,
  );
const TITLE = "How AI describes Example Ramen House";

describe("ClientSwitcher: How AI describes {Business}", () => {
  const t = { businesses: [{ id: "b1", name: "Example Ramen House" }], businessId: "b1", formAction: "/team" };
  it("the row names the client and opens the document", async () => {
    const onNarrative = vi.fn();
    const user = userEvent.setup();
    render(<ClientSwitcher team={t} onClients={vi.fn()} onNarrative={onNarrative} />);
    await user.click(screen.getByRole("button", { name: "Client Example Ramen House" }));
    await user.click(screen.getByRole("button", { name: TITLE }));
    expect(onNarrative).toHaveBeenCalled();
  });

  it("no narrative (flag off): no row", async () => {
    const user = userEvent.setup();
    render(<ClientSwitcher team={t} onClients={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Client Example Ramen House" }));
    expect(screen.queryByRole("button", { name: TITLE })).toBeNull();
  });
});

describe("the team's narrative document", () => {
  it("titled for the client, with the client's own editor labels and counts", () => {
    doc(team());
    expect(screen.getByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
    expect(screen.queryByText(c.settingsTitle)).toBeNull();
    const want = screen.getByRole("group", { name: c.want });
    expect(within(want).getByText("fresh").closest("li")).toHaveTextContent("in 20 of 48 answers");
    expect(screen.getByRole("group", { name: c.avoid })).toBeInTheDocument();
  });

  it("Save goes through the team action for this client", async () => {
    const save = vi.fn<Save>(async () => ({ ok: true }));
    doc(team({}, save));
    const user = userEvent.setup();
    await user.click(
      within(screen.getByRole("group", { name: c.avoid })).getByRole("button", { name: c.remove("cheap") }),
    );
    await user.click(screen.getByRole("button", { name: c.save }));
    expect(save).toHaveBeenCalledWith("b1", {
      want: ["fresh", "family friendly", "handmade noodles"],
      avoid: ["greasy"],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(c.saved);
  });

  it("too few answers: the same line as /app Settings, and no counts", () => {
    doc(team({ narrative: { ...exampleNarrative, result: { ...exampleNarrative.result!, tooFew: true } } }));
    expect(screen.getByText(c.tooFew)).toBeInTheDocument();
    expect(screen.queryByText(/in 20 of 48 answers/)).toBeNull();
  });

  it.each([
    ["flag off (no narrative)", { narrative: null }],
    ["no save action", { actions: { ...team().actions, saveNarrative: undefined } }],
  ] as const)("%s: nothing renders", (_, over) => {
    const { container } = doc(team(over as Partial<TeamExtras>));
    expect(container).toBeEmptyDOMElement();
  });

  it("the title is in COPY.md, and the client's labels are unchanged", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    expect(copy).toContain('"How AI describes {Business}"');
    expect(c.teamTitle("Example Ramen House")).toBe(TITLE);
    expect([c.want, c.avoid]).toEqual(["Words that fit you", "Words to avoid"]);
  });
});
