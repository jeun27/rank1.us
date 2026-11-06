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

  it("a site whose check throws is still recorded (unreachable), so it leaves the oldest-first queue", async () => {
    // A queue backed by "no check row yet", like runs_needing_ai_access_check.
    const recorded = new Map<string, { outcome: string }>();
    const queue = ["run-bad", "run-ok"];
    const next = vi.fn(async () => {
      const runId = queue.find((id) => !recorded.has(id));
      return runId ? { runId, domain: `${runId}.example.test` } : null;
    });
    const check = vi.fn(async (domain: string) => {
      if (domain.startsWith("run-bad")) throw new Error("site exploded");
      return CHECK;
    });
    const record = vi.fn(async (runId: string, c: { outcome: string }) => void recorded.set(runId, c));
    const d = deps({ next, check, record });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 1, failed: true });
    expect(recorded.get("run-bad")).toMatchObject({
      outcome: "unreachable",
      domain: "run-bad.example.test",
      pagesChecked: 0,
      errorCode: "error",
    });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 1 });
    expect(check.mock.calls.map((c) => c[0])).toEqual(["run-bad.example.test", "run-ok.example.test"]);
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, skipped: "none" });
    expect(check).toHaveBeenCalledTimes(2); // the bad site was checked once, then skipped
  });

  it("the stored error is a short code only: a PG code passes, anything else becomes 'error'", async () => {
    for (const [thrown, code] of [
      [Object.assign(new Error("x"), { code: "57014" }), "57014"],
      [Object.assign(new Error("x"), { code: "some message with spaces and example.test" }), "error"],
      [new Error("example-ramen.test is down"), "error"],
    ] as const) {
      const d = deps({ check: vi.fn().mockRejectedValue(thrown) });
      await checkFreeAuditAccess(d);
      expect(d.record.mock.calls[0][1]).toMatchObject({ outcome: "unreachable", errorCode: code });
    }
  });

  it("a bad domain is recorded unreachable (bad_domain) without fetching, and never comes back", async () => {
    const recorded = new Map<string, unknown>();
    const next = vi.fn(async () => (recorded.has("run-x") ? null : { runId: "run-x", domain: "not a domain" }));
    const record = vi.fn(async (runId: string, c: unknown) => void recorded.set(runId, c));
    const d = deps({ next, record });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 1, failed: true });
    expect(d.check).not.toHaveBeenCalled();
    expect(recorded.get("run-x")).toMatchObject({ outcome: "unreachable", errorCode: "bad_domain", crawlers: [] });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, skipped: "none" });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("the domain is normalised before the check (scheme, www, case, path stripped)", async () => {
    const d = deps({
      next: vi.fn().mockResolvedValue({ runId: "run-9", domain: " HTTPS://www.Example-Ramen.test/menu " }),
    });
    await checkFreeAuditAccess(d);
    expect(d.check).toHaveBeenCalledWith("example-ramen.test");
  });

  it("a refused record (e.g. 22023) is retried once with the minimal unreachable row, so the queue moves on", async () => {
    const record = vi
      .fn<FreeAuditAccessDeps["record"]>()
      .mockRejectedValueOnce(Object.assign(new Error("bad input"), { code: "22023" }))
      .mockResolvedValueOnce(undefined);
    const d = deps({ record });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 1, failed: true });
    expect(record.mock.calls[1]).toEqual([
      "run-9",
      {
        domain: "example-ramen.test",
        outcome: "unreachable",
        errorCode: "record_failed",
        crawlers: [],
        visibleWords: null,
        statusNormal: null,
        statusGptbot: null,
        cloudflare: false,
        pagesChecked: 0,
      },
    ]);
  });

  it("errors never throw, and the log carries the PG code only (no domain or run id)", async () => {
    // Requirement change (lead, #117 S2): a refused record is retried once, so it logs the retry too.
    const d = deps({
      record: vi.fn().mockRejectedValue(Object.assign(new Error("example-ramen.test bad"), { code: "22023" })),
    });
    expect(await checkFreeAuditAccess(d)).toEqual({ checked: 0, error: "22023" });
    expect(d.log.mock.calls.flat()).toEqual([
      "ai access: free audit record refused (22023), retrying minimal",
      "ai access: free audit failed (22023)",
    ]);
    const n = deps({ next: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "42501" })) });
    expect(await checkFreeAuditAccess(n)).toEqual({ checked: 0, error: "42501" });
  });
});
