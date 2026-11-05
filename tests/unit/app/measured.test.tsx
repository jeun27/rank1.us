import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { exampleRun } from "@/components/audit/example-data";
import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness } from "@/components/app/example-data";
import { latestMeasured, Measured } from "@/components/app/Page";
import { computeMetrics, type MetricCitation } from "@/lib/metrics";

const now = new Date("2026-11-06T12:00:00Z");
const n = (el: HTMLElement) => el.textContent?.match(/(\d[\d,]*) answers/)?.[1];

// Lead (#53): the Fix list n equals the Dashboard n for the same run. A no_overview answer counts in
// jobs_ok but not in the visibility denominator.
describe("latestMeasured", () => {
  const results = exampleRun("complete");
  results.answers[0] = { ...results.answers[0], status: "no_overview" };
  const metrics = computeMetrics({
    answers: results.answers,
    citations: results.citations as MetricCitation[],
    brands: results.brands,
  });
  const latest = { results, metrics };

  it("the fixes page n equals the Dashboard n for a run with a no_overview answer", () => {
    const dash = render(
      <Dashboard
        business={exampleBusiness}
        latest={latest}
        series={{ points: [], visible: false }}
        fixes={[]}
        now={now}
      />,
    );
    const fixes = render(<Measured {...latestMeasured(latest)} now={now} />);
    expect(n(fixes.container)).toBeDefined();
    expect(n(fixes.container)).toBe(n(dash.container));
    expect(Number(n(fixes.container))).not.toBe(results.run.jobs_ok);
  });

  it("has no n or time without a run", () => {
    expect(latestMeasured(null)).toEqual({ checkedAt: null, answers: undefined });
  });
});
