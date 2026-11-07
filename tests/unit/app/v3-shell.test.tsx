import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "@/components/app/AppNav";
import { AppShell } from "@/components/app/AppShell";

const path = { current: "/app/competitors" };
// The shell renders the real ThemeToggle, which reads the system theme.
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
);
afterEach(() => vi.unstubAllGlobals());
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

// v3 PR 2 (D14/D42): the dark rail with grouped items, and a breadcrumb top bar.
describe("v3 /app shell", () => {
  it("the nav keeps every page in order, in 4 groups, each with a decorative icon", () => {
    render(<AppNav />);
    // X2: the md+ rail column; phones use the bottom bar (bottom-nav.spec).
    const nav = screen.getByRole("navigation", { name: "App" }).querySelector<HTMLElement>("[data-rail]")!;
    const groups = within(nav).getAllByRole("list");
    expect(
      groups.map((g) =>
        within(g)
          .getAllByRole("link")
          .map((a) => a.textContent),
      ),
    ).toEqual([
      ["Dashboard"],
      ["Competitors", "Questions", "Sources"],
      // Step 17: Experiments follows the Fix list.
      ["What to fix next", "Experiments", "Reports", "History"],
      ["Billing"],
    ]);
    for (const g of groups)
      for (const a of within(g).getAllByRole("link")) expect(a.querySelector("svg[aria-hidden]")).not.toBeNull();
  });

  it("the rail is a dark subtree in both themes; the breadcrumb is Rank1 / business / page", () => {
    path.current = "/app/sources";
    render(
      <AppShell business={<span>Example Ramen House</span>}>
        <main>
          <h1>Sources</h1>
        </main>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "App" }).closest("[data-theme]")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(crumbs)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items).toEqual(["Rank1", "Example Ramen House", "Sources"]);
    expect(within(crumbs).getByText("Sources")).toHaveAttribute("aria-current", "page");
    expect(within(crumbs).getByRole("link", { name: "Rank1" })).toHaveAttribute("href", "/");
    // X9a: the actions sit in the top bar from md, and inside Account below md.
    const bar = within(screen.getByRole("banner")).getByRole("button", { name: "Dark theme" });
    // The Account copies (rail footer, and the phone bottom bar's More sheet) are switches.
    const account = screen.getAllByRole("switch", { name: "Dark theme" })[0];
    expect(bar.parentElement).toHaveClass("max-md:hidden");
    expect(account.closest("details")).not.toBeNull();
    expect(account.parentElement).toHaveClass("md:hidden");
  });

  // OB1 (planner, lead-approved): no empty crumbs. Without a business (onboarding) the trail is
  // "Rank1 / Add your business": two crumbs, one separator, never "Rank1 / /".
  it("onboarding: no business crumb, and the page crumb says 'Add your business'", () => {
    path.current = "/app/onboarding";
    render(
      <AppShell business={null}>
        <main>
          <h1>Add your business</h1>
        </main>
      </AppShell>,
    );
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(crumbs).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Rank1", "Add your business"]);
    // Separators are CSS on every crumb after the first, so 2 crumbs = 1 separator.
    expect(items.filter((li) => li.previousElementSibling)).toHaveLength(1);
    expect(within(crumbs).getByText("Add your business")).toHaveAttribute("aria-current", "page");
  });

  it("a crumb that renders nothing (an async switcher with no business) is hidden by CSS", () => {
    path.current = "/app/onboarding";
    render(<AppShell business={<></>}>{null}</AppShell>);
    const ol = screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector("ol")!;
    // Hidden when empty, and the next crumb drops its "/" on phones when the crumb before it is empty.
    expect(ol.className.split(" ")).toContain("[&>li:empty]:hidden");
    // While the switcher streams in, its crumb holds only React's <template> placeholder: hidden too.
    expect(within(ol).getAllByRole("listitem")[1].className).toContain("[&:not(:has(>:not(template)))]:hidden");
    expect(within(ol).getAllByRole("listitem").at(-1)!.className).toContain("max-md:[li:empty+&]:before:hidden");
  });
});
