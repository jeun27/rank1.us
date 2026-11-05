import { describe, expect, it } from "vitest";
import { laWeekStart } from "@/lib/queries/weekly";

describe("laWeekStart", () => {
  it("returns the America/Los_Angeles Monday of the week", () => {
    // Monday 2026-11-09 06:00 PST = 14:00 UTC.
    expect(laWeekStart(new Date("2026-11-09T14:00:00Z"))).toBe("2026-11-09");
    // Sunday 2026-11-15 23:30 PST is still that week (UTC is already Monday).
    expect(laWeekStart(new Date("2026-11-16T07:30:00Z"))).toBe("2026-11-09");
    // Monday 00:30 PST starts the next week.
    expect(laWeekStart(new Date("2026-11-16T08:30:00Z"))).toBe("2026-11-16");
  });

  it("is right across both DST changes", () => {
    // Spring forward: Sunday 2026-03-08. Monday 2026-03-09 06:00 PDT = 13:00 UTC.
    expect(laWeekStart(new Date("2026-03-09T13:00:00Z"))).toBe("2026-03-09");
    expect(laWeekStart(new Date("2026-03-08T12:00:00Z"))).toBe("2026-03-02");
    // Fall back: Sunday 2026-11-01. Monday 2026-11-02 06:00 PST = 14:00 UTC.
    expect(laWeekStart(new Date("2026-11-02T14:00:00Z"))).toBe("2026-11-02");
    expect(laWeekStart(new Date("2026-11-01T09:30:00Z"))).toBe("2026-10-26");
  });

  it("crosses month and year ends", () => {
    expect(laWeekStart(new Date("2027-01-01T20:00:00Z"))).toBe("2026-12-28");
  });
});
