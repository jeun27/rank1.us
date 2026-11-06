import { beforeEach, describe, expect, it, vi } from "vitest";

// G7: the Sources page's server action (a public endpoint): validates its input, decides for the signed-in
// member's current business, and refreshes What to fix next and Sources on success.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
vi.mock("@/app/app/current", () => ({ selectedBusinessId: async () => "biz-1" }));
const business = { current: { id: "biz-1" } as { id: string } | null };
vi.mock("@/lib/queries/shell", () => ({ getCurrentBusiness: vi.fn(async () => business.current) }));
vi.mock("@/lib/mentions/service", () => ({ decideMention: vi.fn(async () => ({ fixId: "fix-r17" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { decideMentionAction } = await import("@/app/app/sources/actions");
const { decideMention } = await import("@/lib/mentions/service");
const { revalidatePath } = await import("next/cache");

beforeEach(() => {
  vi.clearAllMocks();
  business.current = { id: "biz-1" };
});

describe("decideMentionAction", () => {
  it("decides for the current business and refreshes both pages", async () => {
    expect(await decideMentionAction("https://lists.example.test/a", "added")).toEqual({ fixId: "fix-r17" });
    expect(decideMention).toHaveBeenCalledWith({ db: true }, "biz-1", "https://lists.example.test/a", "added");
    expect(revalidatePath).toHaveBeenCalledWith("/app/fixes");
    expect(revalidatePath).toHaveBeenCalledWith("/app/sources");
  });

  it.each([
    ["javascript:alert(1)", "added"],
    ["https://lists.example.test/a", "bogus"],
    [123, "added"],
    [`https://x.test/${"a".repeat(2001)}`, "added"],
  ])("refuses bad input (%s, %s) before any call", async (url, status) => {
    expect(await decideMentionAction(url as string, status as "added")).toEqual({ error: "bad_input" });
    expect(decideMention).not.toHaveBeenCalled();
  });

  it("maps the service's refusals to errors, and refreshes nothing", async () => {
    vi.mocked(decideMention).mockResolvedValueOnce("not_allowed");
    expect(await decideMentionAction("https://lists.example.test/a", null)).toEqual({ error: "not_allowed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("no business: an error", async () => {
    business.current = null;
    expect(await decideMentionAction("https://lists.example.test/a", "dismissed")).toEqual({ error: "no_business" });
  });

  it("a thrown error becomes save_failed (never the raw message)", async () => {
    vi.mocked(decideMention).mockRejectedValueOnce(new Error("raw db text"));
    expect(await decideMentionAction("https://lists.example.test/a", "added")).toEqual({ error: "save_failed" });
  });
});
