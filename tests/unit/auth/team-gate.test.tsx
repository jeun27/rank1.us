import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
const getLanding = vi.fn();
vi.mock("@/lib/queries/auth", () => ({ getLanding: () => getLanding() }));
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect ${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: vi.fn() }));
vi.mock("@/components/workspace/Workspace", () => ({ Workspace: () => <div>team workspace</div> }));

const { TeamGate } = await import("@/app/team/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/team gate", () => {
  it.each([
    ["dashboard", "/app"],
    ["onboarding", "/app/onboarding"],
    ["dfy_client", "/client"],
  ])("sends a %s user to %s", async (landing, to) => {
    getLanding.mockResolvedValue(landing);
    await expect(TeamGate()).rejects.toThrow(`redirect ${to}`);
  });

  it("sends a signed-out visitor to /signin", async () => {
    getLanding.mockResolvedValue(null);
    await expect(TeamGate()).rejects.toThrow("redirect /signin?next=%2Fteam");
  });
});
