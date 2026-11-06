import { beforeEach, describe, expect, it, vi } from "vitest";

// G4: the Settings save (a public endpoint): validates the lists like the RPC, saves for the current
// business, refreshes the Dashboard and Settings, never returns a raw message.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
vi.mock("@/app/app/current", () => ({ selectedBusinessId: async () => "biz-1" }));
const business = { current: { id: "biz-1" } as { id: string } | null };
vi.mock("@/lib/queries/shell", () => ({ getCurrentBusiness: vi.fn(async () => business.current) }));
vi.mock("@/lib/queries/narrative", () => ({ setNarrativeWords: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveNarrativeWordsAction } = await import("@/app/app/settings/narrative/actions");
const { setNarrativeWords } = await import("@/lib/queries/narrative");
const { revalidatePath } = await import("next/cache");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_NARRATIVE", "true");
  business.current = { id: "biz-1" };
});

describe("saveNarrativeWordsAction", () => {
  it("saves for the current business and refreshes", async () => {
    expect(await saveNarrativeWordsAction({ want: ["fresh"], avoid: ["cheap"] })).toEqual({ ok: true });
    expect(setNarrativeWords).toHaveBeenCalledWith({ db: true }, "biz-1", { want: ["fresh"], avoid: ["cheap"] });
    expect(revalidatePath).toHaveBeenCalledWith("/app");
    expect(revalidatePath).toHaveBeenCalledWith("/app/settings/narrative");
  });

  it.each([
    [{ want: Array.from({ length: 9 }, (_, i) => `w${i}x`), avoid: [] }],
    [{ want: ["x"], avoid: [] }],
    [{ want: ["a".repeat(41)], avoid: [] }],
    [{ want: ["same"], avoid: ["same"] }],
    [{ want: "fresh", avoid: [] }],
    [null],
  ])("refuses bad input before the RPC: %j", async (input) => {
    expect(await saveNarrativeWordsAction(input as never)).toEqual({ error: "bad_input" });
    expect(setNarrativeWords).not.toHaveBeenCalled();
  });

  it("flag off: disabled", async () => {
    vi.stubEnv("ENABLE_NARRATIVE", "false");
    expect(await saveNarrativeWordsAction({ want: [], avoid: [] })).toEqual({ error: "disabled" });
  });

  it("errors map to codes, never the raw message", async () => {
    vi.mocked(setNarrativeWords).mockRejectedValueOnce(Object.assign(new Error("raw"), { code: "42501" }));
    expect(await saveNarrativeWordsAction({ want: [], avoid: [] })).toEqual({ error: "not_allowed" });
    vi.mocked(setNarrativeWords).mockRejectedValueOnce(new Error("raw db text"));
    expect(await saveNarrativeWordsAction({ want: [], avoid: [] })).toEqual({ error: "save_failed" });
  });
});
