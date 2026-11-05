import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { exampleLatest, exampleRuns } from "@/components/app/example-data";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";

const NOW = new Date("2026-11-05T12:00:00Z");
const business = { name: "Example Ramen House" };
const fixes = { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false };

// Step 12: the DFY client dashboard is read-only: visibility only, the fix list only when the team shows it.
describe("ClientDashboard (/client)", () => {
  it("success: one H1, the business, hero n + freshness, line, engines, top 5, history; no fixes when hidden", () => {
    render(<ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={null} now={NOW} />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Dashboard"]);
    expect(screen.getByText("Example Ramen House", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByText(/API-measured, directional/).length).toBeGreaterThan(0);
    expect(screen.getByRole("table", { name: "History" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "History" })).getAllByRole("row")).toHaveLength(
      exampleRuns.length + 1,
    );
    expect(screen.queryByRole("heading", { name: "What to fix next" })).toBeNull();
    expect(screen.queryByText(/share of voice/i)).toBeNull();
  });

  it("history rows don't link to /app (owner-only) or offer downloads", () => {
    render(<ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={null} now={NOW} />);
    const links = screen.queryAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    expect(links.filter((h) => h.startsWith("/app"))).toEqual([]);
    expect(screen.queryByText("Download CSV")).toBeNull();
  });

  it("fix list shown: the shared FixList, read-only (no Status select)", () => {
    render(<ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={fixes} now={NOW} />);
    expect(screen.getByRole("heading", { level: 2, name: "What to fix next" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: exampleFixes[0].title })).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).toBeNull();
  });

  it("no run yet: the first-check note", () => {
    render(<ClientDashboard business={business} latest={null} runs={[]} fixes={null} now={NOW} />);
    expect(screen.getByText("No weekly checks yet. Your first one runs Monday.")).toBeInTheDocument();
  });

  it("access removed: 'Nothing tracked yet.' and no button", () => {
    render(<ClientDashboard business={null} latest={null} runs={[]} fixes={null} now={NOW} />);
    expect(screen.getByText("Nothing tracked yet.", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
