import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const path = { current: "/app/fixes" };
vi.mock("next/navigation", () => ({ usePathname: () => path.current, useSearchParams: () => new URLSearchParams() }));

import { AppNav } from "@/components/app/AppNav";

// X2: the phone bottom bar marks the current page; a page under More marks More instead.
describe("phone bottom bar", () => {
  const bar = () => screen.getByRole("navigation", { name: "App" }).querySelector<HTMLElement>("[data-bottom-nav]")!;

  it("Dashboard · What to fix next · Competitors · More, with the current page marked", () => {
    path.current = "/app/fixes";
    render(<AppNav />);
    expect(
      within(bar())
        .getAllByRole("link")
        .slice(0, 3)
        .map((a) => a.textContent),
    ).toEqual(["Dashboard", "What to fix next", "Competitors"]);
    expect(within(bar()).getByRole("link", { name: "What to fix next" })).toHaveAttribute("aria-current", "page");
    expect(within(bar()).getByText("More").closest("summary")).not.toHaveClass("text-ink");
  });

  it("a page under More (Billing) lights More and is marked inside the sheet", () => {
    path.current = "/app/billing";
    render(<AppNav />);
    expect(within(bar()).getByText("More").closest("summary")).toHaveClass("text-ink");
    const sheet = bar().querySelector<HTMLElement>("[data-more-sheet]")!;
    expect(within(sheet).getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
  });

  it("no bottom bar while onboarding", () => {
    path.current = "/app/onboarding";
    render(<AppNav />);
    expect(bar()).toBeNull();
  });
});
