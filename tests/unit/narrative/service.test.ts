import { beforeEach, describe, expect, it, vi } from "vitest";

const q = vi.hoisted(() => ({ getNarrativeWords: vi.fn(), getQuestionsWithLatestAnswers: vi.fn() }));
vi.mock("@/lib/queries/narrative", async (real) => ({
  ...(await real<object>()),
  getNarrativeWords: q.getNarrativeWords,
}));
vi.mock("@/lib/queries/shell", async (real) => ({
  ...(await real<object>()),
  getQuestionsWithLatestAnswers: q.getQuestionsWithLatestAnswers,
}));
const { loadNarrative } = await import("@/lib/narrative/service");

const ON = { ENABLE_NARRATIVE: "true" };
const business = { name: "Example Ramen House", aliases: ["Ex Ramen"] };
const db = (row: unknown = business) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  }) as never;
const answer = (text: string) => ({ engine: "gemini", run_index: 1, status: "ok", mentioned: true, text });

beforeEach(() => {
  q.getNarrativeWords.mockReset().mockResolvedValue({ want: ["cozy"], avoid: ["cheap"] });
  q.getQuestionsWithLatestAnswers.mockReset().mockResolvedValue({
    run: { id: "run-1", finished_at: "2026-11-02T14:00:00Z" },
    questions: [
      {
        id: "q1",
        answers: [answer("Ex Ramen is cozy."), { ...answer("Example Ramen House is cheap."), engine: "perplexity" }],
      },
      { id: "q2", answers: [answer("Example Ramen House is cheap.")] },
    ],
  });
});

describe("loadNarrative", () => {
  it("matches the caller's latest answers against the business's words (name + aliases)", async () => {
    const r = await loadNarrative(db(), "biz-1", ON);
    expect(q.getNarrativeWords).toHaveBeenCalledWith(expect.anything(), "biz-1");
    expect(r).toMatchObject({
      words: { want: ["cozy"], avoid: ["cheap"] },
      checkedAt: "2026-11-02T14:00:00Z",
      result: { n: 3, want: [{ word: "cozy", answers: 1 }], avoid: [{ word: "cheap", answers: 2 }], clashes: 2 },
    });
  });

  it("no words yet → the words with no result (the 'Add your words' state); no run → result null", async () => {
    q.getNarrativeWords.mockResolvedValue({ want: [], avoid: [] });
    expect(await loadNarrative(db(), "biz-1", ON)).toMatchObject({ result: null });
    q.getNarrativeWords.mockResolvedValue({ want: ["cozy"], avoid: [] });
    q.getQuestionsWithLatestAnswers.mockResolvedValue({ run: null, questions: [] });
    expect(await loadNarrative(db(), "biz-1", ON)).toMatchObject({ result: null, checkedAt: null });
  });

  it("a business the caller can't read → null; flag off → disabled, nothing read", async () => {
    q.getNarrativeWords.mockResolvedValue(null);
    expect(await loadNarrative(db(), "biz-1", ON)).toBeNull();
    expect(await loadNarrative(db(null), "biz-1", ON)).toBeNull();
    q.getNarrativeWords.mockClear();
    expect(await loadNarrative(db(), "biz-1", {})).toBe("disabled");
    expect(q.getNarrativeWords).not.toHaveBeenCalled();
  });
});
