import { beforeEach, describe, expect, it, vi } from "vitest";

// C-c PR 2: the team's GBP preview/apply actions (public endpoints): only a DFY client the team can read, only
// the three v1 fields as strings, behind ENABLE_CONNECTIONS; the service re-checks access and the allowlist.
// Codes only, never raw text.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ svc: true }) }));
vi.mock("@/lib/queries/team", () => ({ listDfyBusinesses: vi.fn(async () => [{ id: "biz-1" }]) }));
vi.mock("@/lib/queries/connections", async (actual) => ({
  ...(await actual<object>()),
  listConnections: vi.fn(async () => [{ id: "g1", provider: "gbp", status: "connected", selected_entities: [] }]),
}));
const svc = vi.hoisted(() => ({
  previewGbpEdit: vi.fn(async () => ({ changes: [{ field: "website_uri", before: "a", after: "b" }] })),
  applyGbpEdit: vi.fn(async () => ({ applied: 1 })),
}));
vi.mock("@/lib/connections/service", () => svc);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { previewTeamGbpEdit, applyTeamGbpEdit } = await import("@/app/team/actions");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_CONNECTIONS", "true");
});

describe("previewTeamGbpEdit / applyTeamGbpEdit", () => {
  it("preview: the business's GBP connection, the filled fields only", async () => {
    expect(await previewTeamGbpEdit("biz-1", "locations/1", { website_uri: "https://x.test" })).toEqual({
      changes: [{ field: "website_uri", before: "a", after: "b" }],
    });
    expect(svc.previewGbpEdit).toHaveBeenCalledWith(
      expect.objectContaining({ userDb: { db: true } }),
      "g1",
      "locations/1",
      { website_uri: "https://x.test" },
    );
  });

  it("apply: exactly the confirmed diff", async () => {
    const confirmed = [{ field: "website_uri", before: "a", after: "b" }];
    expect(await applyTeamGbpEdit("biz-1", "locations/1", { website_uri: "b" }, confirmed)).toEqual({ applied: 1 });
    expect(svc.applyGbpEdit).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
      "locations/1",
      { website_uri: "b" },
      confirmed,
    );
  });

  it.each([
    [{ regular_hours: {} }],
    [{ attributes: {} }],
    [{ description: 5 }],
    [{ website_uri: "x".repeat(2001) }],
    [{}],
    [null],
  ])("refuses fields off the v1 allowlist or bad values before the service: %j", async (edit) => {
    expect(await previewTeamGbpEdit("biz-1", "locations/1", edit as never)).toEqual({ error: "bad_input" });
    expect(svc.previewGbpEdit).not.toHaveBeenCalled();
  });

  it("an unknown client, the flag off, a bad location: refused", async () => {
    expect(await previewTeamGbpEdit("biz-x", "locations/1", { description: "x" })).toEqual({ error: "not_found" });
    expect(await previewTeamGbpEdit("biz-1", "", { description: "x" })).toEqual({ error: "bad_input" });
    vi.stubEnv("ENABLE_CONNECTIONS", "false");
    expect(await previewTeamGbpEdit("biz-1", "locations/1", { description: "x" })).toEqual({ error: "disabled" });
    expect(svc.previewGbpEdit).not.toHaveBeenCalled();
  });

  it("the service's refusals are codes (stale included); a throw is save_failed", async () => {
    svc.applyGbpEdit.mockResolvedValueOnce("stale" as never);
    expect(await applyTeamGbpEdit("biz-1", "locations/1", { description: "x" }, [])).toEqual({ error: "stale" });
    svc.previewGbpEdit.mockRejectedValueOnce(new Error("raw google text"));
    expect(await previewTeamGbpEdit("biz-1", "locations/1", { description: "x" })).toEqual({ error: "save_failed" });
  });
});
