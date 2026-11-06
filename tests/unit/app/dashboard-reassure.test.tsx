import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleFixes, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

// G2 (lead 2026-11-06): the quiet "AI can read your site" line sits right under the hero, before the
// next-fix card and the C-b card.
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Dashboard reassure slot", () => {
  it("under the hero, before the C-b notice", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={exampleLatest}
        series={seriesFromSummaries(exampleRuns)}
        fixes={exampleFixes}
        now={new Date("2026-11-05T14:30:00Z")}
        reassure={<p>Reassure line</p>}
        notice={<section aria-label="Notice">n</section>}
      />,
    );
    const line = screen.getByText("Reassure line");
    expect(before(screen.getAllByText(/named in \d+ of \d+ answers/)[0], line)).toBe(true);
    expect(before(line, screen.getByRole("region", { name: "Notice" }))).toBe(true);
  });
});
