import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, listRunsNeedingAiAccess, recordAiAccessCheck } from "@/lib/queries/ai-access";
import { anonClient, must, newUser, serviceClient } from "./helpers";

// 0032: free audits still needing a G2 check: complete/partial free_audit runs of the last 7 days
// with no ai_access_checks row, oldest first. The domain is free_audits.domain. Service only.
const s = () => serviceClient();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

// A free audit run with its lead + snapshot, as create_free_audit leaves it, then given a status.
async function freeAudit(domain: string, status: string, startedAt: string) {
  const lead = must(
    await s()
      .from("leads")
      .insert({ email: `lead-${randomUUID()}@example.test`, domain, token: randomUUID() })
      .select("id")
      .single(),
  ).id;
  const run = must(
    await s().from("runs").insert({ kind: "free_audit", status, started_at: startedAt }).select("id").single(),
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

const check = (domain: string) => ({
  domain,
  outcome: "good" as const,
  crawlers: AI_CRAWLERS.map((agent) => ({ agent, allowed: true, line: null })),
  visibleWords: 500,
  statusNormal: 200,
  statusGptbot: 200,
  cloudflare: false,
  pagesChecked: 1,
});

describe("runs_needing_ai_access_check", () => {
  it("lists finished free audits of the last 7 days without a check, oldest first", async () => {
    const tag = randomUUID().slice(0, 8);
    const older = await freeAudit(`older-${tag}.test`, "complete", daysAgo(3));
    const newer = await freeAudit(`newer-${tag}.test`, "partial", daysAgo(1));
    const running = await freeAudit(`running-${tag}.test`, "running", daysAgo(1));
    const failed = await freeAudit(`failed-${tag}.test`, "failed", daysAgo(1));
    const stale = await freeAudit(`stale-${tag}.test`, "complete", daysAgo(8));
    const checked = await freeAudit(`checked-${tag}.test`, "complete", daysAgo(2));
    await recordAiAccessCheck(s(), checked, check(`checked-${tag}.test`));
    const paid = must(
      await s()
        .from("runs")
        .insert({ kind: "weekly", status: "complete", started_at: daysAgo(1) })
        .select("id")
        .single(),
    ).id;

    const all = await listRunsNeedingAiAccess(s(), 100);
    const ids = all.map((r) => r.runId);
    expect(ids).toContain(older);
    expect(ids).toContain(newer);
    expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer));
    for (const id of [running, failed, stale, checked, paid]) expect(ids).not.toContain(id);
    expect(all.find((r) => r.runId === older)).toEqual({ runId: older, domain: `older-${tag}.test` });
  });

  it("honours the limit; a null or non-positive limit returns nothing", async () => {
    const tag = randomUUID().slice(0, 8);
    await freeAudit(`a-${tag}.test`, "complete", daysAgo(1));
    await freeAudit(`b-${tag}.test`, "complete", daysAgo(1));
    expect(await listRunsNeedingAiAccess(s(), 1)).toHaveLength(1);
    expect(await listRunsNeedingAiAccess(s(), 0)).toEqual([]);
  });

  it("refuses signed-in users and anon (42501)", async () => {
    const user = await newUser("pending-user");
    for (const db of [user.db, anonClient()]) {
      await expect(listRunsNeedingAiAccess(db, 5)).rejects.toMatchObject({ code: "42501" });
    }
  });
});
