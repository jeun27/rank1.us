import { describe, expect, it, vi } from "vitest";
import { MIN_TIME_LEFT_MS, checkFixesForOneRun, type FixCheckDeps } from "@/lib/fixes/cron";
import { evaluateFixes, type FixResult, type RuleKey } from "@/lib/fixes";
import { H, RAMEN, home, menuHtml, site } from "./site";

const ALL: RuleKey[] = ["R10", "R11", "R14", "H1"];
const results: FixResult[] = ALL.map((rule_key) => ({ rule_key, result: "ok", evidence: {}, detail: null }));
const base = () => ({
  enabledRules: vi.fn<FixCheckDeps["enabledRules"]>(async () => ALL),
  next: vi.fn<FixCheckDeps["next"]>(async () => ({
    runId: "run-1",
    businessId: "b-1",
    domain: "example-ramen-house.test",
  })),
  evaluate: vi.fn<FixCheckDeps["evaluate"]>(async () => results),
  record: vi.fn<FixCheckDeps["record"]>(async () => {}),
  timeLeftMs: () => 200_000,
  log: vi.fn<(l: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });
const recorded = (d: ReturnType<typeof deps>, call = 0) =>
  d.record.mock.calls[call][2].map((r) => [r.rule_key, r.result, (r.evidence as { reason?: string }).reason]);

describe("checkFixesForOneRun", () => {
  it("evaluates one run for the enabled rules and records them", async () => {
    const d = deps();
    expect(await checkFixesForOneRun(d)).toEqual({ checked: "run-1" });
    expect(d.evaluate).toHaveBeenCalledWith({ domain: "example-ramen-house.test" }, ALL);
    expect(d.record).toHaveBeenCalledWith("b-1", "run-1", results);
    expect(d.next).toHaveBeenCalledTimes(1);
  });

  it("guard 1: only rules enabled in fix_rules right now are evaluated and recorded", async () => {
    const d = deps({ enabledRules: vi.fn(async () => ["R10", "R14", "A1"] as RuleKey[]) });
    await checkFixesForOneRun(d);
    expect(d.evaluate).toHaveBeenCalledWith({ domain: "example-ramen-house.test" }, ["R10", "R14"]);
    expect(recorded(d).map((r) => r[0])).toEqual(["R10", "R14"]);
  });

  it("no enabled site rule → nothing listed, crawled or recorded", async () => {
    const d = deps({ enabledRules: vi.fn(async () => []) });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, skipped: "no_rules" });
    expect(d.next).not.toHaveBeenCalled();
    expect(d.evaluate).not.toHaveBeenCalled();
  });

  it("guard 2: a failing record retries once with every enabled rule unchecked 'error', no new crawl", async () => {
    const d = deps();
    d.record.mockRejectedValueOnce({ code: "22023", message: "rule R11 is disabled" });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: "run-1", fallback: true });
    expect(d.evaluate).toHaveBeenCalledTimes(1);
    expect(d.record).toHaveBeenCalledTimes(2);
    expect(recorded(d, 1)).toEqual(ALL.map((r) => [r, "unchecked", "error"]));
    expect(d.log).toHaveBeenCalledWith("fix check: record failed (22023), marking unchecked");
  });

  it("both records failing → error, logged without PII, never thrown", async () => {
    const d = deps();
    d.record.mockRejectedValue({ code: "40P01", message: "deadlock on example-ramen-house.test" });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, error: "40P01" });
    expect(d.record).toHaveBeenCalledTimes(2);
    expect(d.log.mock.calls.flat().join(" ")).not.toContain("example-ramen-house.test");
  });

  it("an evaluate error records every enabled rule as unchecked, so the run isn't retried every tick", async () => {
    const d = deps({ evaluate: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: "run-1" });
    expect(recorded(d)).toEqual(ALL.map((r) => [r, "unchecked", "error"]));
  });

  it("skips with less than 60 s left, without reading rules or listing runs", async () => {
    const d = deps({ timeLeftMs: () => MIN_TIME_LEFT_MS - 1 });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, skipped: "time" });
    expect(d.enabledRules).not.toHaveBeenCalled();
    expect(d.next).not.toHaveBeenCalled();
  });

  it("nothing to check → skipped none", async () => {
    expect(await checkFixesForOneRun(deps({ next: vi.fn(async () => null) }))).toEqual({
      checked: null,
      skipped: "none",
    });
  });

  it("a failing rules read → error, no crawl", async () => {
    const d = deps({ enabledRules: vi.fn(async () => Promise.reject({ code: "42501" })) });
    expect(await checkFixesForOneRun(d)).toEqual({ checked: null, error: "42501" });
    expect(d.evaluate).not.toHaveBeenCalled();
  });
});

describe("evaluateFixes with rules", () => {
  it("returns only the requested rules and skips the R11 crawl when R11 is off", async () => {
    const many = Array.from({ length: 10 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join("");
    const s = site({ [`${H}/`]: { body: home() + many }, [`${H}/menu`]: { body: menuHtml(RAMEN) } });
    const rs = await evaluateFixes({ domain: "example-ramen-house.test" }, { ...s, rules: ["R10", "R14", "H1"] });
    expect(rs.map((r) => r.rule_key)).toEqual(["R10", "R14", "H1"]);
    expect(s.fetch.mock.calls.map((c) => String(c[0])).filter((u) => /\/p\d$/.test(u))).toEqual([]);
  });
});
