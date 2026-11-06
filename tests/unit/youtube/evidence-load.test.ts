import { beforeEach, describe, expect, it, vi } from "vitest";

// G1: /app/fixes loads the YouTube checklist (a live read) only with ENABLE_CONNECTIONS on, an open P4 fix
// (R19–R21) to attach it to, and a YouTube connection; never otherwise.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ service: true }) }));
const conns = { current: [] as { id: string; provider: string; status: string }[] };
vi.mock("@/lib/queries/connections", () => ({ listConnections: vi.fn(async () => conns.current) }));
vi.mock("@/lib/connections/service", () => ({
  loadYoutubeChecklist: vi.fn(async () => ({ keyword: "ramen", channel: null, videos: [] })),
}));

const { loadYoutubeEvidence } = await import("@/components/youtube/load");
const { loadYoutubeChecklist } = await import("@/lib/connections/service");
const db = { user: true } as never;
const on = { ENABLE_CONNECTIONS: "true" };

beforeEach(() => {
  vi.clearAllMocks();
  conns.current = [{ id: "y1", provider: "youtube", status: "connected" }];
});

describe("loadYoutubeEvidence", () => {
  it("flag off, or no P4 fix: not read", async () => {
    expect(await loadYoutubeEvidence(db, "biz-1", ["R19"], { ENABLE_CONNECTIONS: "false" })).toBeNull();
    expect(await loadYoutubeEvidence(db, "biz-1", ["R10", "H1"], on)).toBeNull();
    expect(loadYoutubeChecklist).not.toHaveBeenCalled();
  });

  it("no YouTube connection (or a revoked one): null", async () => {
    conns.current = [{ id: "g1", provider: "gbp", status: "connected" }];
    expect(await loadYoutubeEvidence(db, "biz-1", ["R19"], on)).toBeNull();
    conns.current = [{ id: "y1", provider: "youtube", status: "revoked" }];
    expect(await loadYoutubeEvidence(db, "biz-1", ["R19"], on)).toBeNull();
    expect(loadYoutubeChecklist).not.toHaveBeenCalled();
  });

  it("an open P4 fix and a connection: the checklist (or its failure), read with both clients", async () => {
    expect(await loadYoutubeEvidence(db, "biz-1", ["R21"], on)).toEqual({
      keyword: "ramen",
      channel: null,
      videos: [],
    });
    expect(loadYoutubeChecklist).toHaveBeenCalledWith({ userDb: db, serviceDb: { service: true }, env: on }, "y1");
  });
});
