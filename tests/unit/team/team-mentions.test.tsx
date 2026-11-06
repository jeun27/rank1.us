import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocView } from "@/components/workspace/Docs";
import { TeamProvider, type TeamExtras } from "@/components/workspace/team";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";
import { exampleMentions } from "@/components/mentions/example-data";
import { mentionsCopy as c } from "@/components/mentions/copy";
import { buildWorkspace } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";

// C-c PR 3 (D4, lead OK 2026-11-06): G7's lists at the top of the DFY client's Sources document. The team
// decides (canDecide) through a team action that takes the business id; "View" opens the team's Fixes
// document, never /app (that's the team member's own business). Behind ENABLE_MENTIONS (mentions null).
const NOW = new Date("2026-11-05T12:00:00Z");
const view = buildWorkspace(exampleWorkspaceRows());
const team = (over: Partial<TeamExtras> = {}, decide = vi.fn(async () => ({ fixId: "fix-r17" }))): TeamExtras => ({
  businesses: [{ id: "b1", name: "Example Ramen House" }],
  businessId: "b1",
  formAction: "/team",
  input: null,
  fixes: { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false },
  loadSuggestions: vi.fn(async () => []),
  clients: null,
  mentions: { targets: exampleMentions, fixId: "fix-r17" },
  actions: {
    status: vi.fn(async () => undefined),
    add: vi.fn(async () => undefined),
    dismiss: vi.fn(async () => undefined),
    invite: vi.fn(async () => ({ status: "invited" as const })),
    removeClient: vi.fn(async () => undefined),
    setFixListVisible: vi.fn(async () => undefined),
    decideMention: decide,
  },
  ...over,
});
const sources = (t: TeamExtras, onPick = vi.fn()) => {
  render(
    <TeamProvider value={t}>
      <DocView view={view} sel={{ kind: "section", section: "sources" }} now={NOW} onPick={onPick} />
    </TeamProvider>,
  );
  return { onPick, user: userEvent.setup() };
};

describe("the team's Sources document: G7 mentions", () => {
  it("the lists come first, above the engine table, as a level-3 section under the document title", () => {
    sources(team());
    const section = screen.getByRole("region", { name: c.title });
    expect(screen.getByRole("heading", { level: 3, name: c.title })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Sources" });
    expect(section.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Add to fixes decides for this client through the team action", async () => {
    const decide = vi.fn(async () => ({ fixId: "fix-r17" }));
    const { user } = sources(team({}, decide));
    const row = document.querySelector('[data-url="https://lists.example.test/best-ramen-irvine"]') as HTMLElement;
    await user.click(within(row).getByRole("button", { name: c.add }));
    expect(decide).toHaveBeenCalledWith("b1", "https://lists.example.test/best-ramen-irvine", "added");
    expect(within(row).getByText(c.added)).toBeInTheDocument();
  });

  it("View opens the team's Fixes document, not /app", async () => {
    const { onPick, user } = sources(team());
    const added = screen.getByRole("list", { name: c.added });
    expect(within(added).queryByRole("link", { name: c.view })).toBeNull();
    await user.click(within(added).getByRole("button", { name: c.view }));
    expect(onPick).toHaveBeenCalledWith({ kind: "section", section: "fixes" });
  });

  it("a failed decision reverts the row with the inline note", async () => {
    const { user } = sources(
      team(
        {},
        vi.fn(async () => ({ error: "not_allowed" })),
      ),
    );
    const row = document.querySelector('[data-url="https://lists.example.test/best-ramen-irvine"]') as HTMLElement;
    await user.click(within(row).getByRole("button", { name: c.add }));
    expect(within(row).getByRole("status")).toHaveTextContent(c.failed);
    expect(within(row).getByRole("button", { name: c.add })).toBeInTheDocument();
  });

  it.each([
    ["flag off (no mentions)", { mentions: null }],
    ["no decide action", { actions: { ...team().actions, decideMention: undefined } }],
  ] as const)("%s: no lists, the engine table stays", (_, over) => {
    sources(team(over as Partial<TeamExtras>));
    expect(screen.queryByRole("region", { name: c.title })).toBeNull();
    expect(screen.getByRole("table", { name: "Sources" })).toBeInTheDocument();
  });

  it("the /app Sources page keeps its level-2 heading and the /app/fixes link (no onView)", async () => {
    const { MentionsSection } = await import("@/components/mentions/MentionsSection");
    render(<MentionsSection targets={exampleMentions} canDecide fixId="fix-r17" decide={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: c.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.view })).toHaveAttribute("href", "/app/fixes#fix-fix-r17");
  });
});
