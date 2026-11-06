import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleFixes, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

// G4 (lead Q2): the narrative slot sits after the C-b card and before the chart.
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Dashboard narrative slot", () => {
  it("after the C-b notice, before Visibility", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={exampleLatest}
        series={seriesFromSummaries(exampleRuns)}
        fixes={exampleFixes}
        now={new Date("2026-11-05T14:30:00Z")}
        notice={<section aria-label="Notice">n</section>}
        narrative={<section aria-label="Narrative">g4</section>}
      />,
    );
    const slot = screen.getByRole("region", { name: "Narrative" });
    expect(before(screen.getByRole("region", { name: "Notice" }), slot)).toBe(true);
    expect(before(slot, screen.getByRole("heading", { name: "Visibility" }))).toBe(true);
  });
});
