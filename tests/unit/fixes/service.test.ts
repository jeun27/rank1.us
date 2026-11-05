import { describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ listRunsNeedingFixChecks: vi.fn(), recordFixResults: vi.fn() }));
vi.mock("@/lib/queries/fixes", () => q);
const evaluate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fixes/evaluate", async (real) => ({ ...(await real<object>()), evaluateFixes: evaluate }));
const { checkFixesWith } = await import("@/lib/fixes/service");

// A service client stub: fix_rules.select("key").eq("enabled", true).in("key", [...]).
function db(rows: { key: string }[]) {
  const calls: unknown[][] = [];
  const chain = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), chain),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), chain),
    in: async (...a: unknown[]) => (calls.push(["in", ...a]), { data: rows, error: null }),
  };
  return { client: { from: (t: string) => (calls.push(["from", t]), chain) } as never, calls };
}

describe("checkFixesWith", () => {
  it("reads enabled site rules from fix_rules, lists 1 run, evaluates those rules and records them", async () => {
    const d = db([{ key: "R10" }, { key: "H1" }]);
    q.listRunsNeedingFixChecks.mockResolvedValue([
      { runId: "run-1", businessId: "b-1", domain: "example-ramen-house.test" },
    ]);
    evaluate.mockResolvedValue([
      { rule_key: "R10", result: "ok", evidence: { kind: "html" }, detail: null },
      { rule_key: "H1", result: "fix", evidence: {}, detail: "Tidy-up: …" },
    ]);
    expect(await checkFixesWith(d.client, () => 200_000)).toEqual({ checked: "run-1" });
    expect(d.calls).toEqual([
      ["from", "fix_rules"],
      ["select", "key"],
      ["eq", "enabled", true],
      ["in", "key", ["R10", "R11", "R14", "H1"]],
    ]);
    expect(q.listRunsNeedingFixChecks).toHaveBeenCalledWith(d.client, 1);
    expect(evaluate).toHaveBeenCalledWith({ domain: "example-ramen-house.test" }, { rules: ["R10", "H1"] });
    expect(q.recordFixResults.mock.calls[0].slice(1)).toEqual([
      "b-1",
      "run-1",
      evaluate.mock.results[0] && (await evaluate.mock.results[0].value),
    ]);
  });
});
