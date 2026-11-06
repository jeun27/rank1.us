import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleRuns } from "@/components/app/example-data";
import { HistoryView } from "@/components/app/HistoryView";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { FixList } from "@/components/fixes/FixList";
import { EmptyState } from "@/components/ui/EmptyState";
import { seriesFromSummaries } from "@/lib/metrics";

const now = new Date("2026-11-05T12:00:00Z");
const series = seriesFromSummaries([]);
const RUNNING = "Your first check is running.";
const MONDAY = "Your first check runs Monday.";
const review = () => screen.queryByRole("link", { name: "Review your questions" });

// X25 (UX plan PR 5, lead edit c): an empty screen points to one next action, chosen from run state.
// A first check queued or running → "is running" (nothing to do); none queued → "runs Monday" + review.
describe("EmptyState", () => {
  it("takes one action link instead of a field, with a 56px Jelly", () => {
    render(<EmptyState message={MONDAY} action={{ label: "Review your questions", href: "/app/questions" }} />);
    expect(screen.getByText(MONDAY)).toBeInTheDocument();
    expect(review()).toHaveAttribute("href", "/app/questions");
    expect(document.querySelector("img")).toHaveAttribute("width", "56");
  });
});

describe("first-check empty states, by run state", () => {
  it("Dashboard (paid, no run yet)", () => {
    const { unmount } = render(
      <Dashboard business={exampleBusiness} latest={null} series={series} fixes={[]} now={now} firstCheck="monday" />,
    );
    expect(screen.getByText(MONDAY)).toBeInTheDocument();
    expect(review()).toHaveAttribute("href", "/app/questions");
    unmount();
    render(
      <Dashboard business={exampleBusiness} latest={null} series={series} fixes={[]} now={now} firstCheck="running" />,
    );
    expect(screen.getByText(RUNNING)).toBeInTheDocument();
    expect(review()).toBeNull();
  });

  it("Fix list with no run yet", () => {
    const props = { ranked: [], tidyUps: [], unchecked: [], noDomain: false, canWrite: true };
    const { unmount } = render(<FixList {...props} firstCheck="monday" />);
    expect(screen.getByText(MONDAY)).toBeInTheDocument();
    expect(review()).toHaveAttribute("href", "/app/questions");
    unmount();
    render(<FixList {...props} firstCheck="running" />);
    expect(screen.getByText(RUNNING)).toBeInTheDocument();
    expect(review()).toBeNull();
  });

  it("Fix list after a run with nothing to fix keeps its own empty line", () => {
    render(<FixList ranked={[]} tidyUps={[]} unchecked={[]} noDomain={false} canWrite />);
    expect(screen.getByText("Nothing to fix yet. Run your first check.")).toBeInTheDocument();
  });

  it("History with no checks keeps its copy and offers the review", () => {
    render(<HistoryView runs={[]} />);
    expect(screen.getByText("No weekly checks yet. Your first one runs Monday.")).toBeInTheDocument();
    expect(review()).toHaveAttribute("href", "/app/questions");
  });

  it("/client with no run: the team's first check, or running", () => {
    const business = { name: "Example Ramen House" };
    const { unmount } = render(<ClientDashboard business={business} latest={null} runs={[]} fixes={null} now={now} />);
    expect(screen.getByText("The team's first check runs Monday.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    unmount();
    const queued = [{ ...exampleRuns[0], status: "running" as const }];
    render(<ClientDashboard business={business} latest={null} runs={queued} fixes={null} now={now} />);
    expect(screen.getByText(RUNNING)).toBeInTheDocument();
  });
});
