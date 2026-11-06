import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "@/components/app/AppNav";
import { AppShell } from "@/components/app/AppShell";

const path = { current: "/app/competitors" };
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
      ["What to fix next", "Reports", "History"],
      ["Billing"],
    ]);
    for (const a of within(nav).getAllByRole("link")) expect(a.querySelector("svg[aria-hidden]")).not.toBeNull();
  });

  it("the rail is a dark subtree in both themes; the breadcrumb is Rank1 / business / page", () => {
    path.current = "/app/sources";
    render(
      <AppShell business={<span>Example Ramen House</span>} actions={<button type="button">Dark theme</button>}>
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
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Dark theme" }));
  });
});
