import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisibilityLine } from "@/components/app/VisibilityLine";
import { exampleRuns } from "@/components/app/example-data";
import { seriesFromSummaries } from "@/lib/metrics";

// X9b (UI.md Chart): axis labels are HTML at a fixed 10.5px mono, so they don't shrink with the SVG
// (they rendered at about 7px on phones). The SVG draws only lines and points.
describe("VisibilityLine axis labels", () => {
  it("renders 0/mid/top % and the first + last date as fixed-size HTML labels, hidden from screen readers", () => {
    const { container } = render(<VisibilityLine points={seriesFromSummaries(exampleRuns).points} />);
    expect(container.querySelectorAll("svg text")).toHaveLength(0);
    const labels = [...container.querySelectorAll("[data-axis]")];
    // DQ5: the axis fits the data (max 33% → 0–40%), always from 0.
    expect(labels.map((l) => l.textContent)).toEqual(["0%", "20%", "40%", "Sep 14, 2026", "Nov 2, 2026"]);
    for (const l of labels) {
      expect(l).toHaveClass("font-mono", "text-[10.5px]", "text-inkMuted");
      expect(l.closest("[aria-hidden=true]")).not.toBeNull();
    }
    // The numbers stay available as a table.
    expect(screen.getByRole("table", { name: "Visibility" })).toBeInTheDocument();
  });
});

// DQ5 (design-quality audit): the y axis ran 0–100% while the data sat at 18–33%, so most of the chart
// was empty, and the SVG height scaled with its width (340px desktop, ~90px phone).
describe("VisibilityLine fits its data", () => {
  const pts = (...named: number[]) =>
    named.map((n, i) => ({
      runId: `r${i}`,
      at: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      metric: { value: n / 100, numerator: n, denominator: 100 },
    }));
  const ticks = (c: HTMLElement) => [...c.querySelectorAll("[data-axis]")].slice(0, 3).map((l) => l.textContent);

  it("tops out at the smallest of 20/40/60/80/100% that holds the highest point, from 0", () => {
    expect(ticks(render(<VisibilityLine points={pts(10, 20)} />).container)).toEqual(["0%", "10%", "20%"]);
    document.body.innerHTML = "";
    expect(ticks(render(<VisibilityLine points={pts(40, 60)} />).container)).toEqual(["0%", "30%", "60%"]);
    document.body.innerHTML = "";
    expect(ticks(render(<VisibilityLine points={pts(90, 100)} />).container)).toEqual(["0%", "50%", "100%"]);
  });

  it("has a fixed height, and labels the last point directly with its %", () => {
    const { container } = render(<VisibilityLine points={pts(10, 30)} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("h-40", "md:h-50");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    const end = container.querySelector("[data-end-label]")!;
    expect(end.textContent).toBe("30%");
    expect(end).toHaveClass("font-mono");
  });
});
