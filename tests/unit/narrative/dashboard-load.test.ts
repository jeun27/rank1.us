import { beforeEach, describe, expect, it, vi } from "vitest";

// #144 S1: the Dashboard reads the cheap word lists first, and loads the answers (loadNarrative) only with
// ENABLE_NARRATIVE on and at least one word saved. No words: the quiet line, without loading answers.
vi.mock("server-only", () => ({}));
const words = {
  current: { want: [] as string[], avoid: [] as string[] } as { want: string[]; avoid: string[] } | null,
};
vi.mock("@/lib/queries/narrative", () => ({ getNarrativeWords: vi.fn(async () => words.current) }));
vi.mock("@/lib/narrative/service", () => ({
  loadNarrative: vi.fn(async () => ({ words: words.current, checkedAt: null, result: null })),
}));

const { loadDashboardNarrative } = await import("@/components/narrative/load");
const { loadNarrative } = await import("@/lib/narrative/service");
const { getNarrativeWords } = await import("@/lib/queries/narrative");
const db = {} as never;

beforeEach(() => vi.clearAllMocks());

describe("loadDashboardNarrative", () => {
  it("flag off: nothing read at all", async () => {
    expect(await loadDashboardNarrative(db, "biz-1", { ENABLE_NARRATIVE: "false" })).toBeNull();
    expect(getNarrativeWords).not.toHaveBeenCalled();
    expect(loadNarrative).not.toHaveBeenCalled();
  });

  it("no words: the no-words view, and loadNarrative isn't called", async () => {
    words.current = { want: [], avoid: [] };
    expect(await loadDashboardNarrative(db, "biz-1", { ENABLE_NARRATIVE: "true" })).toEqual({
      words: { want: [], avoid: [] },
      checkedAt: null,
      result: null,
    });
    expect(loadNarrative).not.toHaveBeenCalled();
  });

  it("an unreadable business: nothing", async () => {
    words.current = null;
    expect(await loadDashboardNarrative(db, "biz-1", { ENABLE_NARRATIVE: "true" })).toBeNull();
    expect(loadNarrative).not.toHaveBeenCalled();
  });

  it("words saved: loads the answers", async () => {
    words.current = { want: ["fresh"], avoid: [] };
    await loadDashboardNarrative(db, "biz-1", { ENABLE_NARRATIVE: "true" });
    expect(loadNarrative).toHaveBeenCalledWith(db, "biz-1", { ENABLE_NARRATIVE: "true" });
  });
});
