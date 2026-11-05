import { describe, expect, it, vi } from "vitest";
import { MIN_TIME_LEFT_MS, checkFixesForOneRun, type FixCheckDeps } from "@/lib/fixes/cron";
import type { FixResult } from "@/lib/fixes";

const results: FixResult[] = [{ rule_key: "R14", result: "ok", evidence: {}, detail: null }];
const deps = (p: Partial<FixCheckDeps> = {}) => ({
  next: vi.fn<FixCheckDeps["next"]>(async () => ({
    runId: "run-1",
    businessId: "b-1",
    domain: "example-ramen-house.test",
  })),
  evaluate: vi.fn<FixCheckDeps["evaluate"]>(async () => results),
  record: vi.fn<FixCheckDeps["record"]>(async () => {}),
  timeLeftMs: () => 200_000,
  log: vi.fn<(l: string) => void>(),
  ...p,
});

describe("checkFixesForOneRun", () => {
  it("evaluates one run and records its results", async () => {
    const d = deps();
    expect(await checkFixesForOneRun(d)).toEqual({ checked: "run-1" });
    expect(d.evaluate).toHaveBeenCalledWith({ domain: "example-ramen-house.test" });
    expect(d.record).toHaveBeenCalledWith("b-1", "run-1", results);
    expect(d.next).toHaveBeenCalledTimes(1);
  });

  it("skips with less than 60 s left, without listing runs", async () => {
    const d = deps({ timeLeftMs: () => MIN_TIME_LEFT_MS - 1 });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, skipped: "time" });
    expect(d.next).not.toHaveBeenCalled();
  });

  it("nothing to check → skipped none", async () => {
    expect(await checkFixesForOneRun(deps({ next: vi.fn(async () => null) }))).toEqual({
      checked: null,
      skipped: "none",
    });
  });

  it("a failing record is logged without PII and never thrown (the run stays listed)", async () => {
    const d = deps({
      record: vi.fn(async () => Promise.reject({ code: "40P01", message: "deadlock on example-ramen-house.test" })),
    });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, error: "40P01" });
    expect(d.log).toHaveBeenCalledWith("fix check: failed (40P01)");
  });
});
