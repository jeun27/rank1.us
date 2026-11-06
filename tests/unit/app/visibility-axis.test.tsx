import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisibilityLine } from "@/components/app/VisibilityLine";
import { exampleRuns } from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

// X9b (UI.md Chart): axis labels are HTML at a fixed 10.5px mono, so they don't shrink with the SVG
// (they rendered at about 7px on phones). The SVG draws only lines and points.
describe("VisibilityLine axis labels", () => {
  it("renders 0/50/100% and the first + last date as fixed-size HTML labels, hidden from screen readers", () => {
    const { container } = render(<VisibilityLine points={seriesFromSummaries(exampleRuns).points} />);
    expect(container.querySelectorAll("svg text")).toHaveLength(0);
    const labels = [...container.querySelectorAll("[data-axis]")];
    expect(labels.map((l) => l.textContent)).toEqual(["0%", "50%", "100%", "Sep 14, 2026", "Nov 2, 2026"]);
    for (const l of labels) {
      expect(l).toHaveClass("font-mono", "text-[10.5px]", "text-inkMuted");
      expect(l.closest("[aria-hidden=true]")).not.toBeNull();
    }
    // The numbers stay available as a table.
    expect(screen.getByRole("table", { name: "Visibility" })).toBeInTheDocument();
  });
});
