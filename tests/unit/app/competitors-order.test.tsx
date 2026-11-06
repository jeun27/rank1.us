import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/competitors" }));

import { CompetitorsView } from "@/components/app/CompetitorsView";
import { exampleLatest, exampleTracked } from "@/components/app/example-data";

const now = new Date("2026-11-05T12:00:00Z");
const actions = { add: vi.fn(async () => undefined), dismiss: vi.fn(async () => undefined) };
const withChange = {
  ...exampleLatest,
  metrics: {
    ...exampleLatest.metrics,
    leaderboard: exampleLatest.metrics.leaderboard.map((b) => (b.kind === "business" ? { ...b, change: 3 } : b)),
  },
};

// X13 (UX plan S8, L3): one focal number. The leaderboard comes first; share of voice is a caption under it
// (with its n); the Change column shows only when some row has a change.
describe("Competitors: leaderboard first", () => {
  it("share of voice is one caption after the table, keeping its n, with no big-number card", () => {
    render(
      <CompetitorsView latest={exampleLatest} tracked={exampleTracked} suggestions={[]} actions={actions} now={now} />,
    );
    const table = screen.getByRole("table", { name: "Competitors" });
    const sov = screen.getByText("Share of voice").closest("p")!;
    expect(sov).toHaveTextContent("Share of voice: 25% (80 of 320)");
    expect(sov).toHaveClass("text-caption");
    expect(within(sov).getByText("25% (80 of 320)")).toHaveClass("font-mono");
    expect(table.compareDocumentPosition(sov) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector(".text-h2")).toBeNull();
  });

  it("hides the Change column when every row would show –, and shows it when one has a change", () => {
    const { unmount } = render(
      <CompetitorsView latest={exampleLatest} tracked={exampleTracked} suggestions={[]} actions={actions} now={now} />,
    );
    expect(screen.queryByRole("columnheader", { name: "Change" })).toBeNull();
    unmount();
    render(
      <CompetitorsView latest={withChange} tracked={exampleTracked} suggestions={[]} actions={actions} now={now} />,
    );
    expect(screen.getByRole("columnheader", { name: "Change" })).toBeInTheDocument();
  });
});
