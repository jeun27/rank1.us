import { describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ listRunsNeedingFixChecks: vi.fn(), recordFixResults: vi.fn() }));
vi.mock("@/lib/queries/fixes", () => q);
const evaluate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fixes/evaluate", async (real) => ({ ...(await real<object>()), evaluateFixes: evaluate }));
const ai = vi.hoisted(() => ({ checkAiAccess: vi.fn() }));
vi.mock("@/lib/site/ai-access", async (real) => ({ ...(await real<object>()), ...ai }));
const store = vi.hoisted(() => ({ recordAiAccessCheck: vi.fn(async () => {}) }));
vi.mock("@/lib/queries/ai-access", async (real) => ({ ...(await real<object>()), ...store }));
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

describe("checkFixesWith with the AI access check (G2, ENABLE_AI_ACCESS_CHECK)", () => {
  const RUN = { runId: "run-1", businessId: "b-1", domain: "example-ramen-house.test" };
  const CHECK = {
    domain: "example-ramen-house.test",
    outcome: "cloudflare",
    crawlers: [],
    visibleWords: 400,
    statusNormal: 200,
    statusGptbot: 200,
    cloudflare: true,
    pagesChecked: 1,
  };

  it("flag on: R16 is read from fix_rules, the check is stored for the run, and R16 joins the one record call", async () => {
    const d = db([{ key: "R10" }, { key: "R16" }]);
    q.listRunsNeedingFixChecks.mockResolvedValue([RUN]);
    evaluate.mockResolvedValue([{ rule_key: "R10", result: "ok", evidence: {}, detail: null }]);
    ai.checkAiAccess.mockResolvedValue({ ...CHECK, crawlers: [{ agent: "GPTBot", allowed: true, line: null }] });
    expect(await checkFixesWith(d.client, () => 200_000, { ENABLE_AI_ACCESS_CHECK: "true" })).toEqual({
      checked: "run-1",
    });
    expect(d.calls.at(-1)).toEqual(["in", "key", ["R10", "R11", "R14", "H1", "R16"]]);
    expect(evaluate).toHaveBeenCalledWith({ domain: "example-ramen-house.test" }, { rules: ["R10"] });
    expect(ai.checkAiAccess).toHaveBeenCalledWith("example-ramen-house.test");
    expect(store.recordAiAccessCheck.mock.calls[0].slice(1)).toEqual([
      "run-1",
      expect.objectContaining({ outcome: "cloudflare" }),
    ]);
    const recorded = q.recordFixResults.mock.calls.at(-1)![3];
    expect(recorded.map((r: { rule_key: string }) => r.rule_key)).toEqual(["R10", "R16"]);
    expect(recorded[1]).toMatchObject({ result: "fix", detail: expect.stringContaining("Cloudflare") });
  });

  it("flag off: no R16, no check, no request (the live behavior)", async () => {
    const d = db([{ key: "R10" }]);
    q.listRunsNeedingFixChecks.mockResolvedValue([RUN]);
    evaluate.mockResolvedValue([{ rule_key: "R10", result: "ok", evidence: {}, detail: null }]);
    ai.checkAiAccess.mockClear();
    await checkFixesWith(d.client, () => 200_000, {});
    expect(d.calls.at(-1)).toEqual(["in", "key", ["R10", "R11", "R14", "H1"]]);
    expect(ai.checkAiAccess).not.toHaveBeenCalled();
  });

  it("storing the check failing doesn't stop the fixes (logged with its code only)", async () => {
    const d = db([{ key: "R16" }]);
    q.listRunsNeedingFixChecks.mockResolvedValue([RUN]);
    evaluate.mockClear();
    ai.checkAiAccess.mockResolvedValue(CHECK);
    store.recordAiAccessCheck.mockRejectedValueOnce(Object.assign(new Error("secret detail"), { code: "22023" }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkFixesWith(d.client, () => 200_000, { ENABLE_AI_ACCESS_CHECK: "true" })).toEqual({
      checked: "run-1",
    });
    expect(evaluate).not.toHaveBeenCalled(); // only R16 enabled: no site crawl for the other rules
    expect(log.mock.calls.flat().join(" ")).toContain("22023");
    expect(log.mock.calls.flat().join(" ")).not.toContain("secret detail");
    log.mockRestore();
  });
});
