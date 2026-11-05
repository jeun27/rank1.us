import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));

describe("vercel.json", () => {
  it("does not deploy main to production on merge", () => {
    expect(config.git.deploymentEnabled.main).toBe(false);
  });

  it("keeps preview deploys for other branches", () => {
    expect(Object.keys(config.git.deploymentEnabled)).toEqual(["main"]);
  });

  it("pins the crons: the job worker every minute, the weekly check Monday and the monthly report on the 1st", () => {
    // Monday 06:00 America/Los_Angeles is 13:00 UTC in PDT and 14:00 UTC in PST; the route gates on LA time.
    // The 1st at 07:00 LA is 14:00 UTC in PDT and 15:00 UTC in PST (Step 16), gated the same way.
    expect(config.crons).toEqual([
      { path: "/api/cron/run-jobs", schedule: "* * * * *" },
      { path: "/api/cron/weekly", schedule: "0 13,14 * * 1" },
      { path: "/api/cron/monthly-report", schedule: "0 14,15 1 * *" },
    ]);
  });
});
