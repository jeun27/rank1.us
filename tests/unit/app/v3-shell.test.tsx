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
    const nav = screen.getByRole("navigation", { name: "App" });
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
    const [account, bar] = screen.getAllByRole("button", { name: "Dark theme" });
    expect(screen.getByRole("banner")).toContainElement(bar);
    expect(bar.parentElement).toHaveClass("max-md:hidden");
    expect(account.closest("details")).not.toBeNull();
    expect(account.parentElement).toHaveClass("md:hidden");
  });
});
