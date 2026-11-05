import { describe, expect, it } from "vitest";
import { progressFor } from "@/components/audit/progress";
import { exampleRun } from "@/components/audit/example-data";

describe("progressFor (lead: derived from run.jobs_total, no jobs query)", () => {
  it("splits jobs_total into 3q/3q/3q/q and counts answers per engine", () => {
    const r = exampleRun("running", {
      done: { chatgpt: 75, gemini: 30, google_aio: 0, perplexity: 25 },
      failed: { gemini: 4 },
    });
    const p = progressFor(r.run, r.answers);
    expect(p.engines).toEqual([
      { engine: "chatgpt", total: 75, done: 75, failed: 0 },
      { engine: "gemini", total: 75, done: 30, failed: 4 },
      { engine: "google_aio", total: 75, done: 0, failed: 0 },
      { engine: "perplexity", total: 25, done: 25, failed: 0 },
    ]);
    expect(p.done).toBe(130);
    expect(p.total).toBe(250);
  });

  it("an empty run has zero totals instead of dividing by zero", () => {
    const r = exampleRun("queued", { done: {} });
    r.run.jobs_total = 0;
    expect(progressFor(r.run, r.answers)).toMatchObject({ done: 0, total: 0 });
  });
});
