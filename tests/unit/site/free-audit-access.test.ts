import { describe, expect, it, vi } from "vitest";
import { checkFreeAuditAccess, MIN_TIME_LEFT_MS, type FreeAuditAccessDeps } from "@/lib/site/free-audit-access";

const CHECK = {
  domain: "example-ramen.test",
  outcome: "good" as const,
  crawlers: [],
  visibleWords: 300,
  statusNormal: 200,
  statusGptbot: 200,
  cloudflare: false,
  pagesChecked: 1,
};
const base = () => ({
  enabled: true,
  next: vi.fn<FreeAuditAccessDeps["next"]>().mockResolvedValue({ runId: "run-9", domain: "example-ramen.test" }),
  check: vi.fn<FreeAuditAccessDeps["check"]>().mockResolvedValue(CHECK),
  record: vi.fn<FreeAuditAccessDeps["record"]>().mockResolvedValue(undefined),
  timeLeftMs: vi.fn<FreeAuditAccessDeps["timeLeftMs"]>().mockReturnValue(200_000),
  log: vi.fn<(l: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });

describe("checkFreeAuditAccess (the run-jobs hook for free audits)", () => {
  it("checks one free audit's domain and stores it for the run", async () => {
    const d = deps();
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 1 });
    expect(d.check).toHaveBeenCalledWith("example-ramen.test");
    expect(d.record).toHaveBeenCalledWith("run-9", CHECK);
  });

  it("flag off → nothing is read or fetched", async () => {
    const d = deps({ enabled: false });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, skipped: "disabled" });
    expect(d.next).not.toHaveBeenCalled();
  });

  it(`under ${MIN_TIME_LEFT_MS / 1000} s left → skipped, nothing fetched`, async () => {
    const d = deps({ timeLeftMs: vi.fn().mockReturnValue(MIN_TIME_LEFT_MS - 1) });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, skipped: "time" });
    expect(d.next).not.toHaveBeenCalled();
  });

  it("an empty queue → none", async () => {
    expect(await checkFreeAuditAccess(deps({ next: vi.fn().mockResolvedValue(null) }))).toEqual({
      checked: 0,
      skipped: "none",
    });
  });

  it("errors never throw, and the log carries the PG code only (no domain or run id)", async () => {
    const d = deps({
      record: vi.fn().mockRejectedValue(Object.assign(new Error("example-ramen.test bad"), { code: "22023" })),
    });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, error: "22023" });
    const logged = d.log.mock.calls.flat().join(" ");
    expect(logged).toBe("ai access: free audit failed (22023)");
    const n = deps({ next: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "42501" })) });
    expect(await checkFreeAuditAccess(n)).toEqual({ checked: 0, error: "42501" });
  });
});
