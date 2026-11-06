import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import type { TeamExtras } from "@/components/workspace/team";
import { buildWorkspace } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";

vi.mock("next/navigation", () => ({ usePathname: () => "/team" }));

const view = buildWorkspace(exampleWorkspaceRows());
const team = {
  businesses: [
    { id: view.business.id, name: view.business.name },
    { id: "b2", name: "Example Taco Stand" },
  ],
  businessId: view.business.id,
  formAction: "/team",
  input: null,
  fixes: { ranked: [], tidyUps: [], unchecked: [], noDomain: false },
  loadSuggestions: async () => [],
  clients: { users: [], fixListVisible: false },
  actions: {},
} as unknown as TeamExtras;

// jsdom has neither; the document tabs scroll the active tab into view.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

// v3 PR 2b (D14, D20, D21, D42): the dark rail, a breadcrumb top bar with the client switcher, the
// document as main (with the page's one H1), and the Context panel on the right, toggled by "Context".
describe("v3 /team shell", () => {
  it("the rail is the dark #ws-nav on the rail token; the theme toggle is in the top bar", () => {
    render(<Workspace view={view} team={team} />);
    const rail = document.getElementById("ws-nav")!;
    expect(rail.tagName).toBe("NAV");
    expect(rail).toHaveAttribute("data-theme", "dark");
    expect(rail).toHaveClass("bg-rail");
    const bar = screen.getByRole("banner");
    expect(within(bar).getByRole("button", { name: "Dark theme" })).toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: "Dark theme" })).toBeNull();
    expect(within(rail).getByRole("link", { name: "Rank1" })).toHaveAttribute("href", "/");
  });

  it("the breadcrumb is Rank1 / client switcher / section, and follows the nav", async () => {
    const user = userEvent.setup();
    render(<Workspace view={view} team={team} />);
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(crumbs).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole("link", { name: "Rank1" })).toHaveAttribute("href", "/");
    expect(within(items[1]).getByRole("button", { name: `Client ${view.business.name}` })).toHaveAttribute(
      "aria-haspopup",
      "listbox",
    );
    expect(items[2]).toHaveTextContent("Dashboard");
    expect(within(items[2]).getByText("Dashboard")).toHaveAttribute("aria-current", "page");
    await user.click(within(document.getElementById("ws-nav")!).getAllByRole("button", { name: "Sources" })[0]);
    expect(items[2]).toHaveTextContent("Sources");
  });

  it("main is the document with the one H1 (the section label); Context is the aside on the right", async () => {
    const user = userEvent.setup();
    render(<Workspace view={view} team={team} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "ws-document");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
    expect(within(main).getByRole("tablist", { name: "Document" })).toBeInTheDocument();
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("id", "ws-context");
    expect(within(aside).getByRole("button", { name: "Copy context" })).toBeInTheDocument();
    // The aside comes after main, so it sits on the right.
    expect(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The client switcher is no longer in the context pane.
    expect(within(aside).queryByLabelText("Client")).toBeNull();
    await user.click(within(document.getElementById("ws-nav")!).getAllByRole("button", { name: "Questions" })[0]);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Questions");
  });

  // X16: Context starts closed (the document is the one focal panel); the D21 toggle opens it.
  it('"Context" toggles the panel: closed by default, aria-expanded, controls #ws-context', async () => {
    const user = userEvent.setup();
    render(<Workspace view={view} team={team} />);
    const toggle = within(screen.getByRole("banner")).getByRole("button", { name: "Context" });
    expect(toggle).toHaveAttribute("aria-controls", "ws-context");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("ws-context")).toHaveClass("md:hidden");
    expect(screen.queryByRole("separator", { name: "Resize panes" })).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("ws-context")).not.toHaveClass("md:hidden");
    expect(screen.getByRole("separator", { name: "Resize panes" })).toHaveAttribute("aria-controls", "ws-document");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("phones: the tab bar is unchanged (Nav, Context, Document) and starts on Document", () => {
    render(<Workspace view={view} team={team} />);
    const bar = screen.getByRole("tablist", { name: "Workspace" });
    const tabs = within(bar).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Nav", "Context", "Document"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true"]);
    expect(tabs[2]).toHaveAttribute("aria-controls", "ws-document");
  });

  it("the switcher's Clients row opens the Clients tab in the document", async () => {
    const user = userEvent.setup();
    render(<Workspace view={view} team={team} />);
    await user.click(screen.getByRole("button", { name: `Client ${view.business.name}` }));
    await user.click(screen.getByRole("button", { name: "Clients" }));
    expect(
      within(screen.getByRole("tablist", { name: "Document" })).getByRole("tab", { selected: true }),
    ).toHaveTextContent("Clients");
  });
});
