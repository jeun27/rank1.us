import { beforeEach, describe, expect, it, vi } from "vitest";

// C-c PR 1: the team's G3 Dismiss. Only for a DFY client the team can read, behind ENABLE_CONNECTIONS; the RPC
// checks the team again. Errors are codes.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/queries/team", () => ({ listDfyBusinesses: vi.fn(async () => [{ id: "biz-1" }]) }));
vi.mock("@/lib/queries/gas-ready", () => ({ dismissGasReady: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { dismissTeamReady } = await import("@/app/team/actions");
const { dismissGasReady } = await import("@/lib/queries/gas-ready");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_CONNECTIONS", "true");
});

describe("dismissTeamReady", () => {
  it("dismisses for a DFY client the team can read", async () => {
    expect(await dismissTeamReady("biz-1")).toBeUndefined();
    expect(dismissGasReady).toHaveBeenCalledWith({ db: true }, "biz-1");
  });

  it("an unknown client: not_found, no RPC", async () => {
    expect(await dismissTeamReady("biz-x")).toEqual({ error: "not_found" });
    expect(dismissGasReady).not.toHaveBeenCalled();
  });

  it("flag off: disabled, no RPC", async () => {
    vi.stubEnv("ENABLE_CONNECTIONS", "false");
    expect(await dismissTeamReady("biz-1")).toEqual({ error: "disabled" });
    expect(dismissGasReady).not.toHaveBeenCalled();
  });

  it("the RPC refuses: its code", async () => {
    vi.mocked(dismissGasReady).mockRejectedValueOnce({ code: "42501", message: "raw" });
    expect(await dismissTeamReady("biz-1")).toEqual({ error: "42501" });
  });
});
