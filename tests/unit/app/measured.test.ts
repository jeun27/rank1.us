import { describe, expect, it } from "vitest";
import { runMeasured } from "@/components/app/Page";
import { exampleRuns } from "@/components/app/example-data";

// Lead (#53): n is the run's visibility denominator (ok answers with a question), the number the
// Dashboard and History show. jobs_ok also counts no_overview answers, so it must not be used.
describe("runMeasured", () => {
  it("uses the latest run's visibility n, not jobs_ok", () => {
    const run = exampleRuns[1];
    expect(run.jobs_ok).not.toBe(run.visibility.denominator);
    expect(runMeasured(run)).toEqual({ checkedAt: run.finished_at, answers: run.visibility.denominator });
  });

  it("has no n or time without a run", () => {
    expect(runMeasured(undefined)).toEqual({ checkedAt: null, answers: undefined });
  });
});
