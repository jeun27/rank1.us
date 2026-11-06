import { afterEach, describe, expect, it, vi } from "vitest";

// G2: /audit reads the free audit's stored check with the service client, only behind ENABLE_AI_ACCESS_CHECK.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ service: true }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/queries/results", () => ({
  getFreeAuditByToken: vi.fn(async () => ({ run: { id: "run-1" }, answers: [], citations: [], brands: [] })),
  getRunResults: vi.fn(),
  getPreviousRun: vi.fn(),
}));
vi.mock("@/lib/metrics", () => ({ computeMetrics: () => ({}) }));
vi.mock("@/lib/queries/ai-access", () => ({
  getAiAccessCheck: vi.fn(async () => ({ run_id: "run-1", outcome: "good" })),
}));

const { loadFreeAudit } = await import("@/components/audit/load");
const { getAiAccessCheck } = await import("@/lib/queries/ai-access");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("loadFreeAudit: the AI access check", () => {
  it("flag off: not read", async () => {
    vi.stubEnv("ENABLE_AI_ACCESS_CHECK", "false");
    expect((await loadFreeAudit("tok"))?.aiAccess).toBeNull();
    expect(getAiAccessCheck).not.toHaveBeenCalled();
  });

  it("flag on: the run's check, read with the service client", async () => {
    vi.stubEnv("ENABLE_AI_ACCESS_CHECK", "true");
    expect((await loadFreeAudit("tok"))?.aiAccess).toEqual({ run_id: "run-1", outcome: "good" });
    expect(getAiAccessCheck).toHaveBeenCalledWith({ service: true }, "run-1");
  });
});
