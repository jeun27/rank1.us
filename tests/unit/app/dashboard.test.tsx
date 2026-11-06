import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleFixes, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

const now = new Date("2026-11-05T12:00:00Z");
const series = seriesFromSummaries(exampleRuns);
const fix = { ...exampleFixes[0], detail: "Your robots.txt blocks OAI-SearchBot from /menu." };
const notice = <aside aria-label="Connect card">C-b</aside>;

// X1 (UX plan S3/S4/L1): the answer, then the one next fix, then C-b's card only when relevant, then the rest.
describe("Dashboard slots", () => {
  it("orders hero → next fix → C-b notice → Visibility → Competitors → By engine (closed)", () => {
    const { container } = render(
      <Dashboard
        business={exampleBusiness}
        latest={exampleLatest}
        series={series}
        fixes={[fix]}
        now={now}
        notice={notice}
      />,
    );
    const marks = [
      screen.getAllByText("named in 80 of 240 answers")[0],
      screen.getByRole("region", { name: "What to fix next" }),
      screen.getByRole("complementary", { name: "Connect card" }),
      screen.getByRole("heading", { name: "Visibility" }),
      screen.getByRole("heading", { name: "Competitors" }),
      screen.getByText("By engine"),
    ];
    for (let i = 1; i < marks.length; i++)
      expect(marks[i - 1].compareDocumentPosition(marks[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const details = container.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByRole("table", { name: "Engine" })).toBeInTheDocument();
  });

  it("the card: status mark, title, evidence, affected n, and one text link to that fix; no primary button", () => {
    render(<Dashboard business={exampleBusiness} latest={exampleLatest} series={series} fixes={[fix]} now={now} />);
    const card = screen.getByRole("region", { name: "What to fix next" });
    expect(within(card).getByRole("img", { name: `${fix.title}: To do` })).toBeInTheDocument();
    expect(within(card).getByText(fix.title)).toBeInTheDocument();
    expect(within(card).getByText(fix.detail)).toHaveClass("line-clamp-3");
    expect(within(card).getByText("41 affected answers")).toBeInTheDocument();
    const links = within(card).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("What to fix next");
    expect(links[0]).toHaveAttribute("href", `/app/fixes#fix-${fix.id}`);
    expect(card.querySelector(".bg-accent")).toBeNull();
  });

  it("hides the affected line when n is unknown (site rules)", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={exampleLatest}
        series={series}
        fixes={[{ ...fix, affected_answers: null }]}
        now={now}
      />,
    );
    expect(screen.queryByText(/affected answers/)).not.toBeInTheDocument();
  });

  it("no open fix: no card, no placeholder, and the hero isn't in a split row", () => {
    const { container } = render(
      <Dashboard business={exampleBusiness} latest={exampleLatest} series={series} fixes={[]} now={now} />,
    );
    expect(screen.queryByRole("region", { name: "What to fix next" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing to fix yet. Run your first check.")).not.toBeInTheDocument();
    expect(container.querySelector(".md\\:grid-cols-12")).toBeNull();
  });
});
