import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({
  listMentionDecisions: vi.fn(),
  setMentionTarget: vi.fn(),
  upsertMentionFix: vi.fn(),
  listRunSummaries: vi.fn(),
  getRunResults: vi.fn(),
}));
vi.mock("@/lib/queries/mentions", async (real) => ({ ...(await real<object>()), ...q }));
vi.mock("@/lib/queries/shell", async (real) => ({ ...(await real<object>()), listRunSummaries: q.listRunSummaries }));
vi.mock("@/lib/queries/results", async (real) => ({ ...(await real<object>()), getRunResults: q.getRunResults }));

const { decideMention, loadMentions, R17_MANY, R17_MANY_NO_NAMES, R17_ONE, R17_ONE_NO_NAMES } =
  await import("@/lib/mentions/service");

const userDb = {} as never;
const ON = { ENABLE_MENTIONS: "true" };
const LIST = "https://example-eats.test/best";
const RESULTS = {
  brands: [
    { name: "Example Ramen House", kind: "business", domain: null },
    { name: "Example Noodle Bar", kind: "competitor", domain: null },
  ],
  answers: [
    {
      id: "a1",
      engine: "gemini",
      status: "ok",
      question_id: "q1",
      mentioned: false,
      brands: [
        { name: "Example Ramen House", kind: "business", mentioned: false, position: null },
        { name: "Example Noodle Bar", kind: "competitor", mentioned: true, position: 1 },
      ],
    },
  ],
  citations: [{ answer_id: "a1", url: LIST, domain: "example-eats.test", title: null, category: "news_blog" }],
};

beforeEach(() => {
  for (const f of Object.values(q)) f.mockReset();
  q.listRunSummaries.mockResolvedValue([{ id: "run-1" }]);
  q.getRunResults.mockImplementation(async (_db: unknown, id: string) => (id === "run-1" ? RESULTS : null));
  q.listMentionDecisions.mockResolvedValue([]);
  q.upsertMentionFix.mockResolvedValue("fix-1");
});

describe("loadMentions", () => {
  it("reads the latest complete/partial run and the decisions with the caller's client", async () => {
    const r = await loadMentions(userDb, "biz-1", ON);
    expect(q.listRunSummaries).toHaveBeenCalledWith(userDb, "biz-1", 8, ["complete", "partial"]);
    expect(q.getRunResults).toHaveBeenCalledWith(userDb, "run-1");
    expect(r).toMatchObject({ n: 1, candidates: [{ url: LIST, rivals: ["Example Noodle Bar"] }] });
  });

  it("no run yet → null; flag off → disabled", async () => {
    q.listRunSummaries.mockResolvedValue([]);
    expect(await loadMentions(userDb, "biz-1", ON)).toBeNull();
    expect(await loadMentions(userDb, "biz-1", {})).toBe("disabled");
  });
});

const reads = () =>
  q.listRunSummaries.mock.calls.length + q.getRunResults.mock.calls.length + q.listMentionDecisions.mock.calls.length;

describe("query counts and freshness (reviews of #131, #143)", () => {
  it("a page render reads once: one run list (8 back), one decisions read, only the runs it needs", async () => {
    await loadMentions(userDb, "biz-1", ON);
    expect(q.listRunSummaries).toHaveBeenCalledTimes(1);
    expect(q.listMentionDecisions).toHaveBeenCalledTimes(1);
    expect(q.getRunResults).toHaveBeenCalledTimes(1); // nothing added → no history lookups
  });

  it("a decision: save, re-read the decisions once, the latest run, then upsert (no history when not needed)", async () => {
    q.listMentionDecisions.mockResolvedValue([{ url: LIST, status: "added", decided_at: "x" }]);
    await decideMention(userDb, "biz-1", LIST, "added", ON);
    expect(q.setMentionTarget).toHaveBeenCalledTimes(1);
    expect(q.listMentionDecisions).toHaveBeenCalledTimes(1);
    expect(q.listRunSummaries).toHaveBeenCalledTimes(1);
    expect(q.getRunResults).toHaveBeenCalledTimes(1);
    expect(q.upsertMentionFix).toHaveBeenCalledTimes(1);
    expect(q.setMentionTarget.mock.invocationCallOrder[0]).toBeLessThan(
      q.listMentionDecisions.mock.invocationCallOrder[0],
    );
  });

  it("B1: R17's n always equals the stored added count (two quick clicks, or a change from another tab)", async () => {
    const stored = new Map<string, "added" | "dismissed">();
    q.setMentionTarget.mockImplementation(
      async (_db: unknown, _b: string, url: string, st: "added" | "dismissed" | null) => {
        if (st) stored.set(url, st);
        else stored.delete(url);
      },
    );
    q.listMentionDecisions.mockImplementation(async () =>
      [...stored].map(([url, status]) => ({ url, status, decided_at: "x" })),
    );
    await decideMention(userDb, "biz-1", LIST, "added", ON);
    stored.set("https://other-tab.test/list", "added"); // another tab added one meanwhile
    await decideMention(userDb, "biz-1", "https://reddit.test/r/irvine", "added", ON);
    const added = [...stored.values()].filter((v) => v === "added").length;
    expect(added).toBe(3);
    expect(q.upsertMentionFix.mock.calls.at(-1)![2]).toMatch(/^3 lists AI cite /);
  });

  it("B2: the action's inputs are only business, url and status (the client never sends R17 copy or a view)", () => {
    expect(decideMention.length).toBe(4); // (db, businessId, url, status[, env])
  });
});

describe("decideMention", () => {
  it("'Add to fixes' saves the decision, then upserts the grouped R17 fix at once with the filled copy", async () => {
    q.listMentionDecisions.mockResolvedValue([{ url: LIST, status: "added", decided_at: "x" }]);
    expect(await decideMention(userDb, "biz-1", LIST, "added", ON)).toEqual({ fixId: "fix-1" });
    expect(q.setMentionTarget).toHaveBeenCalledWith(userDb, "biz-1", LIST, "added");
    expect(q.upsertMentionFix).toHaveBeenCalledWith(
      userDb,
      "biz-1",
      "1 list AI cites names Example Noodle Bar but not you.",
    );
    expect(q.setMentionTarget.mock.invocationCallOrder[0]).toBeLessThan(q.upsertMentionFix.mock.invocationCallOrder[0]);
  });

  it("'Not relevant' or clearing still refreshes R17 (the RPC deletes it when nothing is added)", async () => {
    expect(await decideMention(userDb, "biz-1", LIST, "dismissed", ON)).toEqual({ fixId: "fix-1" });
    const [, , detail] = q.upsertMentionFix.mock.calls[0];
    expect(detail.length).toBeGreaterThan(0); // the RPC requires a detail even when it deletes
    await decideMention(userDb, "biz-1", LIST, null, ON);
    expect(q.setMentionTarget).toHaveBeenLastCalledWith(userDb, "biz-1", LIST, null);
  });

  it("an added list no longer in the latest run keeps its last known rivals (from an earlier run)", async () => {
    const OLD = "https://old-list.test/best";
    const older = {
      ...RESULTS,
      brands: [...RESULTS.brands, { name: "Example Pho Spot", kind: "competitor", domain: null }],
      answers: [
        {
          ...RESULTS.answers[0],
          id: "b1",
          brands: [
            { name: "Example Ramen House", kind: "business", mentioned: false, position: null },
            { name: "Example Pho Spot", kind: "competitor", mentioned: true, position: 1 },
          ],
        },
      ],
      citations: [{ answer_id: "b1", url: OLD, domain: "old-list.test", title: null, category: "news_blog" }],
    };
    q.listRunSummaries.mockResolvedValue([{ id: "run-1" }, { id: "run-0" }]);
    q.getRunResults.mockImplementation(async (_db: unknown, id: string) => (id === "run-1" ? RESULTS : older));
    q.listMentionDecisions.mockResolvedValue([{ url: OLD, status: "added", decided_at: "x" }]);
    await decideMention(userDb, "biz-1", OLD, "added", ON);
    expect(q.upsertMentionFix.mock.calls[0][2]).toBe("1 list AI cites names Example Pho Spot but not you.");
  });

  it("no known rivals for any added list → the copy without names, never the competitor list", async () => {
    q.listMentionDecisions.mockResolvedValue([{ url: "https://never-seen.test/x", status: "added", decided_at: "x" }]);
    await decideMention(userDb, "biz-1", "https://never-seen.test/x", "added", ON);
    expect(q.upsertMentionFix.mock.calls[0][2]).toBe("1 list AI cites doesn't name you.");
    q.listMentionDecisions.mockResolvedValue([
      { url: "https://never-seen.test/x", status: "added", decided_at: "x" },
      { url: "https://never-seen.test/y", status: "added", decided_at: "y" },
    ]);
    await decideMention(userDb, "biz-1", "https://never-seen.test/y", "added", ON);
    expect(q.upsertMentionFix.mock.calls.at(-1)![2]).toBe("2 lists AI cite don't name you.");
  });

  it("n counts every added list; rivals come from the lists still cited", async () => {
    q.listMentionDecisions.mockResolvedValue([
      { url: LIST, status: "added", decided_at: "x" },
      { url: "https://old-list.test/gone", status: "added", decided_at: "y" },
    ]);
    await decideMention(userDb, "biz-1", LIST, "added", ON);
    expect(q.upsertMentionFix.mock.calls[0][2]).toBe("2 lists AI cite name Example Noodle Bar but not you.");
  });

  it("a dfy_client (42501 from either RPC) → not_allowed; flag off → disabled, nothing written", async () => {
    q.setMentionTarget.mockRejectedValue(Object.assign(new Error("x"), { code: "42501" }));
    expect(await decideMention(userDb, "biz-1", LIST, "added", ON)).toBe("not_allowed");
    expect(q.upsertMentionFix).not.toHaveBeenCalled();
    q.setMentionTarget.mockReset();
    expect(await decideMention(userDb, "biz-1", LIST, "added", {})).toBe("disabled");
    expect(q.setMentionTarget).not.toHaveBeenCalled();
  });

  it("errors map to their real cause: a bad URL (set) vs the R17 rule or detail (upsert)", async () => {
    q.setMentionTarget.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "22023" }));
    expect(await decideMention(userDb, "biz-1", "nope", "added", ON)).toBe("bad_url");
    q.upsertMentionFix.mockRejectedValueOnce(Object.assign(new Error("mention_rule_unavailable"), { code: "22023" }));
    expect(await decideMention(userDb, "biz-1", LIST, "added", ON)).toBe("rule_unavailable");
    q.upsertMentionFix.mockRejectedValueOnce(
      Object.assign(new Error("The fix needs detail text of at most 2000 characters"), { code: "22023" }),
    );
    expect(await decideMention(userDb, "biz-1", LIST, "added", ON)).toBe("bad_detail");
  });
});

describe("R17 copy", () => {
  // Lead, 2026-11-06: singular for one list, and the plural verb "cite". The detail text is built here and
  // sent to upsert_mention_fix, so the source of truth is COPY.md (migration 0030's row still holds the
  // first wording; backend updates it). Test change, with reason: it used to check 0030 verbatim.
  it("both forms are COPY.md's, verbatim", () => {
    const copy = readFileSync(`${process.cwd()}/docs/COPY.md`, "utf8");
    expect(R17_ONE).toBe("1 list AI cites names {rivals} but not you.");
    expect(R17_MANY).toBe("{n} lists AI cite name {rivals} but not you.");
    expect(R17_ONE_NO_NAMES).toBe("1 list AI cites doesn't name you.");
    expect(R17_MANY_NO_NAMES).toBe("{n} lists AI cite don't name you.");
    for (const c of [R17_ONE, R17_MANY, R17_ONE_NO_NAMES, R17_MANY_NO_NAMES]) expect(copy).toContain(`"${c}"`);
  });
});
