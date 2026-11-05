import { describe, expect, it, vi } from "vitest";
import { isWeeklyWindow, laWeekStart, runWeekly, type WeeklyDeps } from "@/lib/runs/weekly";

const at = (iso: string) => new Date(iso);

describe("isWeeklyWindow (Monday 06:xx America/Los_Angeles)", () => {
  it.each([
    // PST (UTC-8): 06:00 LA = 14:00 UTC
    ["2026-03-02T14:00:00Z", true, "Mar 2, PST, 14:00 UTC"],
    ["2026-03-02T13:00:00Z", false, "Mar 2, PST, 13:00 UTC is 05:00 LA"],
    // PDT (UTC-7) after the Mar 8 switch: 06:00 LA = 13:00 UTC
    ["2026-03-09T13:00:00Z", true, "Mar 9, PDT, 13:00 UTC"],
    ["2026-03-09T14:00:00Z", false, "Mar 9, PDT, 14:00 UTC is 07:00 LA"],
    ["2026-10-26T13:00:00Z", true, "Oct 26, PDT, 13:00 UTC"],
    ["2026-10-26T14:00:00Z", false, "Oct 26, PDT, 14:00 UTC"],
    // PST again after the Nov 1 switch
    ["2026-11-02T14:00:00Z", true, "Nov 2, PST, 14:00 UTC"],
    ["2026-11-02T13:00:00Z", false, "Nov 2, PST, 13:00 UTC"],
    // edges
    ["2026-11-02T14:59:59Z", true, "06:59:59 LA"],
    ["2026-11-02T13:59:59Z", false, "05:59:59 LA"],
    ["2026-11-02T15:00:00Z", false, "07:00 LA"],
    ["2026-11-01T14:00:00Z", false, "a Sunday"],
    ["2026-11-03T14:00:00Z", false, "a Tuesday"],
  ])("%s → %s (%s)", (iso, want) => {
    expect(isWeeklyWindow(at(iso))).toBe(want);
  });

  it("exactly one of the two Monday fires (13:00, 14:00 UTC) matches, every Monday of 2026", () => {
    const d = new Date("2026-01-05T00:00:00Z");
    for (; d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 7)) {
      const day = d.toISOString().slice(0, 10);
      const hits = ["13", "14"].filter((h) => isWeeklyWindow(new Date(`${day}T${h}:00:00Z`)));
      expect(hits, day).toHaveLength(1);
    }
  });
});

describe("laWeekStart", () => {
  it("is the LA Monday's date, the same for both fires and any time that week", () => {
    expect(laWeekStart(at("2026-11-02T14:00:00Z"))).toBe("2026-11-02");
    expect(laWeekStart(at("2026-11-02T13:00:00Z"))).toBe("2026-11-02");
    expect(laWeekStart(at("2026-03-09T13:00:00Z"))).toBe("2026-03-09");
    expect(laWeekStart(at("2026-11-08T23:00:00Z"))).toBe("2026-11-02"); // Sunday 15:00 LA
    expect(laWeekStart(at("2026-11-09T07:30:00Z"))).toBe("2026-11-02"); // still Sunday 23:30 LA
  });
});

describe("runWeekly", () => {
  const MONDAY = () => at("2026-11-02T14:00:00Z");
  const base = () => ({
    enqueue: vi.fn<WeeklyDeps["enqueue"]>(async () => ({ enqueued: 3, skipped: 2 })),
    prune: vi.fn<WeeklyDeps["prune"]>(async () => ({ lookup_cache: 7, rate_events: 40 })),
    now: MONDAY,
    log: vi.fn<(l: string) => void>(),
  });
  const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });

  it("outside the window: a no-op, no DB call", async () => {
    const d = deps({ now: () => at("2026-11-02T13:00:00Z") });
    expect(await runWeekly(d)).toEqual({ status: 200, body: { skipped: "outside_window" } });
    expect(d.enqueue).not.toHaveBeenCalled();
    expect(d.prune).not.toHaveBeenCalled();
  });

  it("in the window: enqueues for the LA week, prunes, returns counts, logs counts only", async () => {
    const d = deps();
    expect(await runWeekly(d)).toEqual({
      status: 200,
      body: { week_start: "2026-11-02", enqueued: 3, skipped: 2, pruned: { lookup_cache: 7, rate_events: 40 } },
    });
    expect(d.enqueue).toHaveBeenCalledWith("2026-11-02");
    expect(d.log).toHaveBeenCalledWith(
      "weekly 2026-11-02: enqueued=3 skipped=2 failed=0 pruned lookup_cache=7 rate_events=40",
    );
  });

  it("enqueue fails → prune still runs → 500 with no DB text; both outcomes logged as codes", async () => {
    const d = deps({
      enqueue: vi.fn(async () =>
        Promise.reject({ code: "P0402", message: "Example Ramen House needs a subscription" }),
      ),
    });
    const out = await runWeekly(d);
    expect(out).toEqual({ status: 500, body: { error: "enqueue_failed" } });
    expect(d.prune).toHaveBeenCalled();
    const line = d.log.mock.calls[0][0];
    expect(line).toBe("weekly 2026-11-02: enqueue_error=P0402 pruned lookup_cache=7 rate_events=40");
    expect(JSON.stringify(out) + line).not.toMatch(/Example Ramen House|subscription/);
  });

  it("prune fails → 500 prune_failed, enqueue counts still logged", async () => {
    const d = deps({
      prune: vi.fn(async () =>
        Promise.reject({ code: "42501", message: "permission denied for function prune_ephemeral" }),
      ),
    });
    expect(await runWeekly(d)).toEqual({ status: 500, body: { error: "prune_failed" } });
    expect(d.log.mock.calls[0][0]).toBe("weekly 2026-11-02: enqueued=3 skipped=2 failed=0 prune_error=42501");
  });

  it("a synchronously throwing prune is still caught", async () => {
    const d = deps({
      prune: vi.fn<WeeklyDeps["prune"]>(() => {
        throw new Error("sync");
      }),
    });
    expect((await runWeekly(d)).status).toBe(500);
  });
});
