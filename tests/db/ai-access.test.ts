import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  AI_CRAWLERS,
  getAiAccessCheck,
  getLatestAiAccessCheck,
  recordAiAccessCheck,
  type AiAccessInput,
} from "@/lib/queries/ai-access";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

// G2 (0025): "Can AI see your site?" results, one per run. Members (incl. the dfy_client) and the
// team on DFY read their business's; a free audit's is service-only; only the service role writes.
const s = () => serviceClient();
const loose = (db: unknown) => db as SupabaseClient;

const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

const input = (extra: Partial<AiAccessInput> = {}): AiAccessInput => ({
  domain: "example-ramen.test",
  outcome: "blocked",
  crawlers: AI_CRAWLERS.map((agent) => ({
    agent,
    allowed: agent !== "GPTBot",
    line: agent === "GPTBot" ? "User-agent: GPTBot / Disallow: /" : null,
  })),
  visibleWords: 812,
  statusNormal: 200,
  statusGptbot: 403,
  cloudflare: false,
  pagesChecked: 2,
  ...extra,
});

async function run(businessId: string | null, kind = "weekly", startedAt = new Date().toISOString()) {
  return must(
    await s()
      .from("runs")
      .insert({ business_id: businessId, kind, status: "complete", started_at: startedAt })
      .select("id")
      .single(),
  ).id as string;
}

let owner: TestUser;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfyBusiness: string;

beforeAll(async () => {
  owner = await newUser("ai-owner");
  await ensureSelfServeWorkspace(owner.db);
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  outsider = await newUser("ai-outsider");
  team = await newUser("ai-team");
  client = await newUser("ai-client");
  const creator = await newUser("ai-creator");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: creator.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  const dfy = await createDfyClient(creator.db, {
    workspace_name: "Example DFY",
    business: { ...business, name: "Example Pho" },
  });
  dfyBusiness = dfy.businessId;
  must(
    await s().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
});

describe("record and read", () => {
  it("stores one check per run; members read it, an outsider doesn't", async () => {
    const r = await run(ownerBusiness);
    await recordAiAccessCheck(s(), r, input());
    const row = await getAiAccessCheck(owner.db, r);
    expect(row).toMatchObject({
      run_id: r,
      business_id: ownerBusiness,
      domain: "example-ramen.test",
      outcome: "blocked",
      visible_words: 812,
      status_normal: 200,
      status_gptbot: 403,
      cloudflare: false,
      pages_checked: 2,
    });
    expect(row?.crawlers).toHaveLength(6);
    expect(row?.crawlers.find((c) => c.agent === "GPTBot")).toEqual({
      agent: "GPTBot",
      allowed: false,
      line: "User-agent: GPTBot / Disallow: /",
    });
    for (const db of [outsider.db, team.db, client.db, anonClient()]) expect(await getAiAccessCheck(db, r)).toBeNull();
  });

  it("is idempotent per run: a repeat replaces the result", async () => {
    const r = await run(ownerBusiness);
    await recordAiAccessCheck(s(), r, input());
    await recordAiAccessCheck(s(), r, input({ outcome: "good", statusGptbot: 200 }));
    const rows = must(await s().from("ai_access_checks").select("outcome, status_gptbot").eq("run_id", r));
    expect(rows).toEqual([{ outcome: "good", status_gptbot: 200 }]);
  });

  it("the latest check of a business is its newest run's", async () => {
    const older = await run(ownerBusiness, "weekly", new Date(Date.now() - 7 * 86400_000).toISOString());
    await recordAiAccessCheck(s(), older, input({ outcome: "js_empty" }));
    const newer = await run(ownerBusiness);
    await recordAiAccessCheck(s(), newer, input({ outcome: "cloudflare", cloudflare: true }));
    expect(await getLatestAiAccessCheck(owner.db, ownerBusiness)).toMatchObject({
      run_id: newer,
      outcome: "cloudflare",
    });
    expect(await getLatestAiAccessCheck(outsider.db, ownerBusiness)).toBeNull();
  });

  it("the dfy_client and the team read a DFY business's check", async () => {
    const r = await run(dfyBusiness);
    await recordAiAccessCheck(s(), r, input({ domain: "example-pho.test", outcome: "good" }));
    for (const db of [client.db, team.db]) {
      expect(await getLatestAiAccessCheck(db, dfyBusiness)).toMatchObject({ run_id: r, outcome: "good" });
    }
  });

  it("a free audit's check is service-only, even when the run names a business", async () => {
    for (const businessId of [null, ownerBusiness]) {
      const r = await run(businessId, "free_audit");
      await recordAiAccessCheck(s(), r, input({ outcome: "unreachable", visibleWords: null, statusNormal: null }));
      expect(await getAiAccessCheck(owner.db, r)).toBeNull();
      expect(await getAiAccessCheck(anonClient(), r)).toBeNull();
      expect(await getAiAccessCheck(s(), r)).toMatchObject({ outcome: "unreachable", visible_words: null });
    }
  });

  it("is removed with its run", async () => {
    const r = await run(ownerBusiness);
    await recordAiAccessCheck(s(), r, input());
    must(await s().from("runs").delete().eq("id", r));
    expect(must(await s().from("ai_access_checks").select("run_id").eq("run_id", r))).toEqual([]);
  });
});

describe("writes", () => {
  it("users and anon can't call the RPC or write the table (42501)", async () => {
    const r = await run(ownerBusiness);
    for (const db of [owner.db, team.db, anonClient()]) {
      await expect(recordAiAccessCheck(db, r, input())).rejects.toMatchObject({ code: "42501" });
      const { error } = await loose(db)
        .from("ai_access_checks")
        .insert({ run_id: r, domain: "x.test", outcome: "good", crawlers: [] });
      expect(error?.code).toBe("42501");
    }
  });

  const bad: [string, () => Partial<AiAccessInput>][] = [
    ["an unknown crawler", () => ({ crawlers: [{ agent: "Bingbot" as never, allowed: true, line: null }] })],
    ["an unknown outcome", () => ({ outcome: "maybe" as never })],
    ["a negative word count", () => ({ visibleWords: -1 })],
    ["an impossible HTTP status", () => ({ statusGptbot: 99 })],
    ["a non-hostname domain", () => ({ domain: "not a domain" })],
    [
      "a crawler line over 500 characters",
      () => ({ crawlers: [{ agent: "GPTBot", allowed: false, line: "x".repeat(501) }] }),
    ],
  ];
  for (const [label, patch] of bad) {
    it(`refuses ${label} (22023)`, async () => {
      const r = await run(ownerBusiness);
      await expect(recordAiAccessCheck(s(), r, input(patch()))).rejects.toMatchObject({ code: "22023" });
    });
  }

  it("refuses an unknown run (22023)", async () => {
    await expect(recordAiAccessCheck(s(), crypto.randomUUID(), input())).rejects.toMatchObject({ code: "22023" });
  });
});

describe("the Cloudflare fix rule", () => {
  it("R16 exists, is enabled, and keeps its why_note internal (its p5 pillar comes from 0024)", async () => {
    const rule = must(
      await s()
        .from("fix_rules")
        .select("key, size, enabled, ai_lever, customer_copy, why_note")
        .eq("key", "R16")
        .single(),
    );
    expect(rule).toMatchObject({ key: "R16", enabled: true, size: "S" });
    expect(rule.customer_copy).toBe(
      "Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt can't show it. Check Security, then Bots, in your Cloudflare dashboard.",
    );
    const visible = must(await owner.db.from("fix_rules_public").select("*").eq("key", "R16"));
    expect(visible).toHaveLength(1);
    expect(visible[0]).not.toHaveProperty("why_note");
  });
});
