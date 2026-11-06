import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getAiAccessCheck, listRunsNeedingAiAccess, recordAiAccessCheck } from "@/lib/queries/ai-access";
import { checkFreeAuditAccess } from "@/lib/site/free-audit-access";
import { must, serviceClient } from "./helpers";

// The G2 free-audit hook against the real record_ai_access_check (#117 S2, backend's #116): a bad domain,
// or a refused first record, still lands an 'unreachable' row, so the run leaves the queue.
const s = () => serviceClient();

async function freeAudit(domain: string) {
  const lead = must(
    await s()
      .from("leads")
      .insert({ email: `lead-${randomUUID()}@example.test`, domain, token: randomUUID() })
      .select("id")
      .single(),
  ).id;
  const run = must(
    await s()
      .from("runs")
      .insert({ kind: "free_audit", status: "complete", started_at: new Date().toISOString() })
      .select("id")
      .single(),
  ).id as string;
  must(
    await s()
      .from("free_audits")
      .insert({
        run_id: run,
        lead_id: lead,
        domain,
        brands: { business: { id: "business", name: domain, aliases: [], domain }, competitors: [] },
        country: "US",
      }),
  );
  return run;
}

// The hook, pointed at one run (other tests share the queue).
const hook = (
  runId: string,
  record = (id: string, c: Parameters<typeof recordAiAccessCheck>[2]) => recordAiAccessCheck(s(), id, c),
) =>
  checkFreeAuditAccess({
    enabled: true,
    next: async () => (await listRunsNeedingAiAccess(s(), 100)).find((r) => r.runId === runId) ?? null,
    check: vi.fn(async () => {
      throw new Error("no network in db tests");
    }),
    record,
    timeLeftMs: () => 200_000,
    log: () => {},
  });

describe("the free-audit hook's unreachable rows (real RPC)", () => {
  it("a bad domain is recorded unreachable (bad_domain) and leaves the queue", async () => {
    const run = await freeAudit(`not a domain ${randomUUID().slice(0, 6)}`);
    expect(await hook(run)).toEqual({ checked: 1, failed: true });
    expect(await getAiAccessCheck(s(), run)).toMatchObject({ outcome: "unreachable", error: "bad_domain" });
    expect((await listRunsNeedingAiAccess(s(), 100)).some((r) => r.runId === run)).toBe(false);
  });

  it("a refused first record falls back to the minimal row, which the RPC accepts", async () => {
    const run = await freeAudit(`retry-${randomUUID().slice(0, 8)}.test`);
    let calls = 0;
    const record = (id: string, c: Parameters<typeof recordAiAccessCheck>[2]) => {
      if (calls++ === 0) return Promise.reject(Object.assign(new Error("refused"), { code: "22023" }));
      return recordAiAccessCheck(s(), id, c);
    };
    expect(await hook(run, record)).toEqual({ checked: 1, failed: true });
    expect(await getAiAccessCheck(s(), run)).toMatchObject({
      outcome: "unreachable",
      error: "record_failed",
      crawlers: [],
      pages_checked: 0,
    });
    expect((await listRunsNeedingAiAccess(s(), 100)).some((r) => r.runId === run)).toBe(false);
  });
});
