import { describe, expect, it } from "vitest";
import { QUEUE_TAGS, queueTag, sortQueue, type QueueRow } from "@/lib/workspace/queue";

// X5 (UX plan PR 19, planner 11:13): /team opens on a client queue tagged with the approved G3 team
// tags, sorted by what needs the team first.
const base = {
  lastRunFailed: false,
  connections: [] as ("connected" | "needs_reauth" | "revoked")[],
  gasReady: false,
  started: false,
};

describe("queue tags", () => {
  // #161 review: needs_reauth or a failed run. A revoked connection is the client's choice; if it was a
  // required one, G3 readiness already makes the client "Waiting on client".
  it("Needs attention: a connection needing reauth, or a failed last run (partial is not attention)", () => {
    expect(queueTag({ ...base, connections: ["connected", "needs_reauth"], gasReady: true })).toBe("attention");
    expect(queueTag({ ...base, lastRunFailed: true })).toBe("attention");
  });
  it("a revoked connection alone is not attention", () => {
    expect(queueTag({ ...base, connections: ["revoked"], gasReady: true })).toBe("ready");
    expect(queueTag({ ...base, connections: ["revoked"] })).toBe("waiting");
  });
  it("Ready for GAS: ready and nothing started; In progress: ready and a fix doing or done", () => {
    expect(queueTag({ ...base, gasReady: true })).toBe("ready");
    expect(queueTag({ ...base, gasReady: true, started: true })).toBe("progress");
  });
  it("Waiting on client: not ready", () => {
    expect(queueTag(base)).toBe("waiting");
  });
  it("labels and tones are the G3 team tags; In progress is neutral (blue is for You/info)", () => {
    expect(QUEUE_TAGS).toEqual({
      attention: { label: "Needs attention", tone: "error" },
      ready: { label: "Ready for GAS", tone: "success" },
      waiting: { label: "Waiting on client", tone: "warn" },
      progress: { label: "In progress", tone: "neutral" },
    });
  });
});

describe("queue order", () => {
  const row = (name: string, tag: QueueRow["tag"], open: number): QueueRow => ({
    id: name,
    name,
    tag,
    visibility: null,
    delta: null,
    open,
  });
  it("attention → ready → waiting → in progress, then open fixes descending, then name", () => {
    const rows = [
      row("B", "progress", 9),
      row("A", "waiting", 1),
      row("C", "ready", 2),
      row("D", "attention", 0),
      row("E", "waiting", 5),
      row("F", "waiting", 5),
    ];
    expect(sortQueue(rows).map((r) => r.name)).toEqual(["D", "C", "E", "F", "A", "B"]);
  });
  it("without G3 (no tags): open fixes descending, then name", () => {
    const rows = [row("Z", null, 1), row("Y", null, 3), row("X", null, 3)];
    expect(sortQueue(rows).map((r) => r.name)).toEqual(["X", "Y", "Z"]);
  });
});
