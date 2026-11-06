import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { Badge } from "@/components/ui/Badge";
import { deltaTone, seriesFromSummaries, signedPts } from "@/lib/metrics";

// The hero's delta tag (the same text can also sit in a table cell).
const tag = (text: string) => screen.getAllByText(text).find((el) => el.classList.contains("rounded-tag"))!;
const now = new Date("2026-11-05T12:00:00Z");
const series = seriesFromSummaries(exampleRuns);
// The example run with "You" moved by `change` points since the last check.
const withChange = (change: number) => ({
  ...exampleLatest,
  metrics: {
    ...exampleLatest.metrics,
    leaderboard: exampleLatest.metrics.leaderboard.map((b) => (b.kind === "business" ? { ...b, change } : b)),
  },
});

// UI.md: deltas are mono and in state colours. Info blue is only for You, info and focus (R2).
describe("delta badges", () => {
  it("signedPts uses a real minus; deltaTone is success / error / neutral", () => {
    expect([signedPts(3), signedPts(-2), signedPts(0)]).toEqual(["+3 pts", "−2 pts", "0 pts"]);
    expect([deltaTone(3), deltaTone(-2), deltaTone(0)]).toEqual(["success", "error", "neutral"]);
  });

  it("Badge mono adds the mono face and its tracking", () => {
    render(
      <Badge tone="success" mono>
        +3 pts
      </Badge>,
    );
    expect(screen.getByText("+3 pts")).toHaveClass("font-mono", "tracking-[-0.03em]");
  });

  it.each([
    [3, "+3 pts", "text-moss"],
    [-2, "−2 pts", "text-brick"],
    [0, "0 pts", "text-text2"],
  ])("the Dashboard and /client hero show %i as a mono state badge, never info blue", (n, text, colour) => {
    const latest = withChange(n);
    const { unmount } = render(
      <Dashboard business={exampleBusiness} latest={latest} series={series} fixes={[]} now={now} />,
    );
    expect(tag(text)).toHaveClass("font-mono", colour);
    expect(tag(text)).not.toHaveClass("text-jellyDeep");
    unmount();
    render(
      <ClientDashboard business={{ name: "Example" }} latest={latest} runs={exampleRuns} fixes={null} now={now} />,
    );
    expect(tag(text)).toHaveClass("font-mono", colour);
  });
});
