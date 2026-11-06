import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { saveConnection, setConnectionStatus, listConnections } from "@/lib/queries/connections";
import { listDoneFixes, listFixes, setFixStatus } from "@/lib/queries/fixes";
import { getGasReady, refreshGasReady } from "@/lib/queries/gas-ready";
import { createDfyClient } from "@/lib/queries/onboarding";
import { listRunSummaries } from "@/lib/queries/shell";
import { listTeamClientQueue, type TeamQueueRow } from "@/lib/queries/team";
import { floorPct } from "@/lib/metrics/compute";
import { makeWorkspace, must, newUser, serviceClient, type TestUser } from "./helpers";

// 0038: team_client_queue() returns the /team queue in one call (#161 fanned out 5 calls per client).
// Rank1 team only; DFY businesses only; the numbers match the per-call reads loadQueue made.
const s = () => serviceClient();
const business = {
  name: "Example Pho Spot",
  domain: "example-pho.test",
  cuisine: "pho",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

let team: TestUser;
let creator: TestUser;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// A run with `named` of `n` ok answers on one question (and a failed answer that never counts).
async function run(businessId: string, status: string, named: number, n: number, startedAt: string) {
  const q = must(
    await s()
      .from("questions")
      .insert({ business_id: businessId, short_text: `q ${randomUUID()}`, location_level: "city", city: "Irvine" })
      .select("id")
      .single(),
  ).id;
  const r = must(
    await s()
      .from("runs")
      .insert({ business_id: businessId, kind: "weekly", status, started_at: startedAt })
      .select("id")
      .single(),
  ).id;
  const answers = [
    ...Array.from({ length: n }, (_, i) => ({ status: "ok", mentioned: i < named })),
    { status: "failed", mentioned: true },
  ].map((a, i) => ({
    run_id: r,
    question_id: q,
    engine: (["chatgpt", "gemini", "google_aio", "perplexity"] as const)[i % 4],
    run_index: (Math.floor(i / 4) % 3) + 1,
    question_text_used: "best pho in Irvine",
    ...a,
  }));
  if (answers.length) must(await s().from("answers").insert(answers));
}

async function dfy(name: string) {
  return (await createDfyClient(creator.db, { workspace_name: name, business: { ...business, name } })).businessId;
}

// The row loadQueue (#161) computed from 5 per-client calls, in the RPC's shape.
async function perCall(db: TestUser["db"], id: string) {
  const [runs, fixes, done, gas, connections] = await Promise.all([
    listRunSummaries(db, id, 3),
    listFixes(db, id),
    listDoneFixes(db, id),
    getGasReady(db, id),
    listConnections(db, id),
  ]);
  const good = runs.filter((r) => r.status === "complete" || r.status === "partial");
  const v = good[0]?.visibility ?? null;
  const [now, before] = [v && floorPct(v), good[1] && floorPct(good[1].visibility)];
  return {
    named: v?.numerator ?? null,
    n: v?.denominator ?? null,
    delta: now != null && before != null ? now - before : null,
    open_fixes: fixes.ranked.length + fixes.tidyUps.length,
    started: fixes.ranked.some((f) => f.status === "doing") || done.length > 0,
    gas_ready: Boolean(gas?.readyAt),
    needs_reauth: connections.some((c) => c.status === "needs_reauth"),
    last_run_failed: runs[0]?.status === "failed",
  };
}

beforeAll(async () => {
  team = await newUser("tq-team");
  creator = await newUser("tq-creator");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: creator.id, role: "team" },
      ]),
  );
  for (const key of ["R10", "R14"])
    must(
      await s()
        .from("fix_rules")
        .upsert(
          {
            key,
            grp: "restaurant",
            title: `Rule ${key}`,
            size: "S",
            cadence: "weekly",
            customer_copy: "Copy",
            enabled: true,
          },
          { onConflict: "key", ignoreDuplicates: true },
        ),
    );
});

describe("team_client_queue", () => {
  it("matches the per-call reads for each kind of client", async () => {
    // A: two good runs (6/10 then 4/10 → +20), one open todo fix, nothing started.
    const a = await dfy(`Example A ${randomUUID().slice(0, 6)}`);
    await run(a, "complete", 4, 10, minutesAgo(30));
    await run(a, "partial", 6, 10, minutesAgo(10));
    must(
      await s()
        .from("fixes")
        .insert({ business_id: a, rule_key: "R10", size: "S", title: "Example", detail: "Detail" }),
    );

    // B: the last run failed; a doing fix (started); gas ready; a connection needing reauth.
    const b = await dfy(`Example B ${randomUUID().slice(0, 6)}`);
    await run(b, "complete", 3, 8, minutesAgo(30));
    await run(b, "failed", 0, 0, minutesAgo(5));
    must(
      await s()
        .from("fixes")
        .insert({ business_id: b, rule_key: "R14", size: "S", title: "Example", detail: "Detail" }),
    );
    const fixB = must(await s().from("fixes").select("id").eq("business_id", b).single()).id;
    await setFixStatus(team.db, fixB, "doing");
    const conn = await saveConnection(s(), {
      businessId: b,
      provider: "gbp",
      externalAccountId: "google-sub-tq",
      scopes: [],
      connectedBy: team.id,
      encAccess: "enc:v1:a",
      encRefresh: "enc:v1:r",
      expiresAt: null,
    });
    await refreshGasReady(s(), b, ["gbp"]);
    await setConnectionStatus(s(), conn, "needs_reauth");

    // C: no runs, no fixes, a done fix only (started).
    const c = await dfy(`Example C ${randomUUID().slice(0, 6)}`);
    must(
      await s()
        .from("fixes")
        .insert({ business_id: c, rule_key: "R10", size: "S", title: "Example", detail: "D", status: "done" }),
    );

    const rows = await listTeamClientQueue(team.db);
    for (const id of [a, b, c]) {
      const row = rows.find((r) => r.id === id) as TeamQueueRow;
      expect(row, id).toBeDefined();
      const { id: _id, name: _name, ...rest } = row;
      void _id;
      void _name;
      expect(rest).toEqual(await perCall(team.db, id));
    }
    expect(rows.find((r) => r.id === a)).toMatchObject({ named: 6, n: 10, delta: 20, open_fixes: 1, started: false });
    expect(rows.find((r) => r.id === b)).toMatchObject({
      last_run_failed: true,
      started: true,
      gas_ready: true,
      needs_reauth: true,
    });
    expect(rows.find((r) => r.id === c)).toMatchObject({ named: null, n: null, delta: null, started: true });
  });

  it("lists active DFY businesses only; no emails or rule text", async () => {
    const owner = await newUser("tq-owner");
    const selfServe = (await makeWorkspace(owner)).businessId;
    const archived = await dfy(`Example Archived ${randomUUID().slice(0, 6)}`);
    must(await s().from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", archived));
    const rows = await listTeamClientQueue(team.db);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(selfServe);
    expect(ids).not.toContain(archived);
    expect(JSON.stringify(rows)).not.toMatch(/@|why_note|engineer/);
  });

  it("refuses anyone but the team (42501)", async () => {
    const owner = await newUser("tq-nonteam");
    const client = await newUser("tq-client");
    must(await s().from("user_roles").insert({ user_id: client.id, role: "dfy_client" }));
    for (const db of [owner.db, client.db]) {
      await expect(listTeamClientQueue(db)).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("answers for ~150 clients in one call, quickly", async () => {
    const ws = must(
      await s().from("workspaces").insert({ name: "Example DFY Load", owner_id: creator.id }).select("id").single(),
    ).id;
    const tag = randomUUID().slice(0, 6);
    const ids = must(
      await s()
        .from("businesses")
        .insert(
          Array.from({ length: 150 }, (_, i) => ({
            workspace_id: ws,
            name: `Example Load ${tag} ${i}`,
            service: "dfy",
          })),
        )
        .select("id"),
    ).map((r) => r.id as string);
    const runs = must(
      await s()
        .from("runs")
        .insert(
          ids.flatMap((id, i) =>
            [0, 1].map((k) => ({
              business_id: id,
              kind: "weekly",
              status: "complete",
              started_at: minutesAgo(60 - k * 10 - (i % 5)),
            })),
          ),
        )
        .select("id"),
    ).map((r) => r.id as string);
    must(
      await s()
        .from("answers")
        .insert(
          runs.flatMap((r) =>
            [0, 1, 2, 3].map((i) => ({
              run_id: r,
              engine: (["chatgpt", "gemini", "google_aio", "perplexity"] as const)[i],
              run_index: 1,
              status: "ok",
              mentioned: i < 2,
              question_text_used: "best pho in Irvine",
            })),
          ),
        ),
    );
    const t0 = Date.now();
    const rows = await listTeamClientQueue(team.db);
    const ms = Date.now() - t0;
    expect(rows.filter((r) => ids.includes(r.id))).toHaveLength(150);
    expect(ms).toBeLessThan(3000);
  });
});
