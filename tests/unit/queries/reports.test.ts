import { describe, expect, it } from "vitest";
import { laPreviousMonthStart } from "@/lib/queries/reports";

describe("laPreviousMonthStart", () => {
  it("is the 1st of the previous month in America/Los_Angeles", () => {
    // 1 Dec 2026 07:30 PST = 15:30 UTC.
    expect(laPreviousMonthStart(new Date("2026-12-01T15:30:00Z"))).toBe("2026-11-01");
    // 1 Dec 2026 05:00 UTC is still 30 Nov in LA.
    expect(laPreviousMonthStart(new Date("2026-12-01T05:00:00Z"))).toBe("2026-10-01");
  });

  it("crosses the year and both DST seasons", () => {
    expect(laPreviousMonthStart(new Date("2027-01-01T15:00:00Z"))).toBe("2026-12-01");
    // 1 Apr 2026 07:00 PDT = 14:00 UTC.
    expect(laPreviousMonthStart(new Date("2026-04-01T14:00:00Z"))).toBe("2026-03-01");
  });
});
