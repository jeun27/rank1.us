import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamQueueRow } from "@/lib/queries/team";
import { queueRowFromRpc } from "@/lib/workspace/queue";

// v0.8.0 blocker: #161's loadQueue fanned out 5 PostgREST calls per DFY client and Kong ran out of
// connections at ~120 clients (/team 500). The queue now comes from team_client_queue() (#169, 0038) in
// one call; its rows map onto QueueRow and the same queueTag/sortQueue (backend handoff 2026-11-06).
const rpc = (over: Partial<TeamQueueRow> = {}): TeamQueueRow => ({
  id: "b1",
  name: "Example Ramen House",
  named: 48,
  n: 240,
  delta: 3,
  open_fixes: 5,
  started: false,
  gas_ready: true,
  needs_reauth: false,
  last_run_failed: false,
  ...over,
});

describe("queueRowFromRpc", () => {
  it("visibility named/n with its base, the delta and the open fixes", () => {
    expect(queueRowFromRpc(rpc(), true)).toEqual({
      id: "b1",
      name: "Example Ramen House",
      tag: "ready",
      visibility: { value: 0.2, numerator: 48, denominator: 240 },
      delta: 3,
      open: 5,
    });
  });

  it("no complete or partial run: no visibility, no delta", () => {
    const r = queueRowFromRpc(rpc({ named: null, n: null, delta: null }), true);
    expect(r.visibility).toBeNull();
    expect(r.delta).toBeNull();
  });

  it.each([
    ["needs_reauth → Needs attention", { needs_reauth: true }, "attention"],
    ["a failed last run → Needs attention", { last_run_failed: true }, "attention"],
    ["not ready → Waiting on client", { gas_ready: false }, "waiting"],
    ["ready and started → In progress", { started: true }, "progress"],
    ["ready, nothing started → Ready for GAS", {}, "ready"],
  ] as const)("%s", (_, over, tag) => {
    expect(queueRowFromRpc(rpc(over), true).tag).toBe(tag);
  });

  it("ENABLE_CONNECTIONS off: no tag", () => {
    expect(queueRowFromRpc(rpc({ needs_reauth: true }), false).tag).toBeNull();
  });
});

vi.mock("server-only", () => ({}));
const team = vi.hoisted(() => ({ listTeamClientQueue: vi.fn() }));
vi.mock("@/lib/queries/team", async (actual) => ({ ...(await actual<object>()), ...team }));
// Any per-client read would be the old fan-out.
const fail = () => {
  throw new Error("per-client read");
};
vi.mock("@/lib/queries/shell", () => ({ listRunSummaries: fail }));
vi.mock("@/lib/queries/fixes", () => ({ listFixes: fail, listDoneFixes: fail }));
vi.mock("@/lib/queries/gas-ready", () => ({ getGasReady: fail }));
vi.mock("@/lib/queries/connections", () => ({ listConnections: fail }));

describe("loadQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ENABLE_CONNECTIONS", "true");
  });

  it("150 clients: one RPC call, no per-client reads, sorted by what needs the team first", async () => {
    const { loadQueue } = await import("@/app/team/queue");
    const rows = Array.from({ length: 150 }, (_, i) =>
      rpc({ id: `b${i}`, name: `Example Client ${String(i).padStart(3, "0")}`, gas_ready: i % 2 === 0 }),
    );
    rows[149] = { ...rows[149], needs_reauth: true };
    team.listTeamClientQueue.mockResolvedValueOnce(rows);
    const db = { db: true } as never;
    const queue = await loadQueue(db);
    expect(team.listTeamClientQueue).toHaveBeenCalledTimes(1);
    expect(team.listTeamClientQueue).toHaveBeenCalledWith(db);
    expect(queue).toHaveLength(150);
    expect(queue[0]).toMatchObject({ id: "b149", tag: "attention" });
    expect(queue[1]).toMatchObject({ name: "Example Client 000", tag: "ready" });
    expect(queue.at(-1)!.tag).toBe("waiting");
  });
});
