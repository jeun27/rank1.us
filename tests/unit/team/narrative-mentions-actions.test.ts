import { beforeEach, describe, expect, it, vi } from "vitest";

// C-c PR 3 (D3/D4): the team sets a DFY client's narrative words and decides its mention lists. Public
// endpoints, so: only a DFY client the team can read, the same input checks as /app, behind each feature's
// flag, and codes only (never raw text). The RPCs check the team again (can_write_business).
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ svc: true }) }));
vi.mock("@/lib/queries/team", () => ({ listDfyBusinesses: vi.fn(async () => [{ id: "biz-1" }]) }));
vi.mock("@/lib/queries/narrative", async (actual) => ({
  ...(await actual<object>()),
  setNarrativeWords: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mentions/service", async (actual) => ({
  ...(await actual<object>()),
  decideMention: vi.fn(async () => ({ fixId: "fix-r17" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveTeamNarrativeWords, decideTeamMention } = await import("@/app/team/actions");
const { setNarrativeWords } = await import("@/lib/queries/narrative");
const { decideMention } = await import("@/lib/mentions/service");
const { revalidatePath } = await import("next/cache");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_NARRATIVE", "true");
  vi.stubEnv("ENABLE_MENTIONS", "true");
});

describe("saveTeamNarrativeWords", () => {
  it("saves the cleaned lists for the DFY client and refreshes /team", async () => {
    expect(await saveTeamNarrativeWords("biz-1", { want: [" Fresh  Noodles "], avoid: ["cheap"] })).toEqual({
      ok: true,
    });
    expect(setNarrativeWords).toHaveBeenCalledWith({ db: true }, "biz-1", {
      want: ["fresh noodles"],
      avoid: ["cheap"],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/team");
  });

  it("a business that isn't one of the team's DFY clients: not_found, no RPC", async () => {
    expect(await saveTeamNarrativeWords("biz-other", { want: ["fresh"], avoid: [] })).toEqual({
      error: "not_found",
    });
    expect(setNarrativeWords).not.toHaveBeenCalled();
  });

  it.each([
    [{ want: Array.from({ length: 9 }, (_, i) => `w${i}x`), avoid: [] }],
    [{ want: ["x"], avoid: [] }],
    [{ want: ["a".repeat(41)], avoid: [] }],
    [{ want: ["same"], avoid: ["same"] }],
    [{ want: "fresh", avoid: [] }],
    [null],
  ])("refuses bad input before the RPC: %j", async (input) => {
    expect(await saveTeamNarrativeWords("biz-1", input as never)).toEqual({ error: "bad_input" });
    expect(setNarrativeWords).not.toHaveBeenCalled();
  });

  it("ENABLE_NARRATIVE off: disabled", async () => {
    vi.stubEnv("ENABLE_NARRATIVE", "false");
    expect(await saveTeamNarrativeWords("biz-1", { want: [], avoid: [] })).toEqual({ error: "disabled" });
    expect(setNarrativeWords).not.toHaveBeenCalled();
  });

  it("errors map to codes, never the raw message, and refresh nothing", async () => {
    vi.mocked(setNarrativeWords).mockRejectedValueOnce(Object.assign(new Error("raw"), { code: "42501" }));
    expect(await saveTeamNarrativeWords("biz-1", { want: [], avoid: [] })).toEqual({ error: "not_allowed" });
    vi.mocked(setNarrativeWords).mockRejectedValueOnce(Object.assign(new Error("raw"), { code: "22023" }));
    expect(await saveTeamNarrativeWords("biz-1", { want: [], avoid: [] })).toEqual({ error: "bad_input" });
    vi.mocked(setNarrativeWords).mockRejectedValueOnce(new Error("raw db text"));
    expect(await saveTeamNarrativeWords("biz-1", { want: [], avoid: [] })).toEqual({ error: "save_failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("decideTeamMention", () => {
  it("decides for the DFY client and refreshes /team", async () => {
    expect(await decideTeamMention("biz-1", "https://lists.example.test/a", "added")).toEqual({ fixId: "fix-r17" });
    expect(decideMention).toHaveBeenCalledWith({ db: true }, "biz-1", "https://lists.example.test/a", "added");
    expect(revalidatePath).toHaveBeenCalledWith("/team");
  });

  it("a business that isn't one of the team's DFY clients: not_found, no call", async () => {
    expect(await decideTeamMention("biz-other", "https://lists.example.test/a", "added")).toEqual({
      error: "not_found",
    });
    expect(decideMention).not.toHaveBeenCalled();
  });

  it.each([
    ["javascript:alert(1)", "added"],
    ["https://lists.example.test/a", "bogus"],
    [123, "added"],
    [`https://x.test/${"a".repeat(2001)}`, "added"],
  ])("refuses bad input (%s, %s) before any call", async (url, status) => {
    expect(await decideTeamMention("biz-1", url as string, status as "added")).toEqual({ error: "bad_input" });
    expect(decideMention).not.toHaveBeenCalled();
  });

  it("the service's refusals are the error codes; a throw is save_failed, never the raw text", async () => {
    vi.mocked(decideMention).mockResolvedValueOnce("not_allowed");
    expect(await decideTeamMention("biz-1", "https://lists.example.test/a", null)).toEqual({ error: "not_allowed" });
    vi.mocked(decideMention).mockResolvedValueOnce("disabled");
    expect(await decideTeamMention("biz-1", "https://lists.example.test/a", null)).toEqual({ error: "disabled" });
    vi.mocked(decideMention).mockRejectedValueOnce(new Error("raw db text"));
    expect(await decideTeamMention("biz-1", "https://lists.example.test/a", null)).toEqual({ error: "save_failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
