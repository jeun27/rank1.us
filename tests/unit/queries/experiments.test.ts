import { describe, expect, it } from "vitest";
import { experimentStatus, laToday } from "@/lib/queries/experiments";

describe("laToday", () => {
  it("is the date in America/Los_Angeles", () => {
    // 6 Nov 2026 07:00 UTC is still 5 Nov in LA (PDT ends 1 Nov, so UTC-8).
    expect(laToday(new Date("2026-11-06T07:00:00Z"))).toBe("2026-11-05");
    expect(laToday(new Date("2026-11-06T08:00:00Z"))).toBe("2026-11-06");
  });
});

describe("experimentStatus", () => {
  const at = (date: string) => new Date(`${date}T20:00:00Z`);

  it("is running until 28 days after the change date, then done", () => {
    const e = { status: "running", change_date: "2026-10-01" };
    expect(experimentStatus(e, at("2026-10-28"))).toBe("running");
    expect(experimentStatus(e, at("2026-10-29"))).toBe("done");
  });

  it("stays ended once ended early, and treats a missing status as running", () => {
    expect(experimentStatus({ status: "ended", change_date: "2026-10-01" }, at("2026-10-05"))).toBe("ended");
    expect(experimentStatus({ status: null, change_date: "2026-10-01" }, at("2026-10-05"))).toBe("running");
  });
});
