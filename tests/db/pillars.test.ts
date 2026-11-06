import { beforeAll, describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { listFixes, recordFixResults } from "@/lib/queries/fixes";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// G5 (0024): every fix rule and fix has a pillar p0..p6. Fixes take their rule's pillar on insert
// (so live v0.5.0's inserts, which don't send one, still get it).
const s = () => serviceClient();

const MAPPING: Record<string, string> = {
  R1: "p3",
  R2: "p3",
  R3: "p3",
  R4: "p3",
  R5: "p3",
  R6: "p3",
  R7: "p3",
  R8: "p3",
  R9: "p3",
  R10: "p5",
  R11: "p2",
  R12: "p3",
  R13: "p3",
  R14: "p5",
  R15: "p3",
  H1: "p2",
  A1: "p1",
  A6: "p1",
};

// The rules as the seed (or a fresh DB after the rollback test) has them: inserted without a pillar.
const rule = (key: string) => ({
  key,
  grp: key === "H1" ? "hygiene" : key.startsWith("A") ? "answers" : "restaurant",
  title: `Rule ${key}`,
  size: "S",
  cadence: "weekly",
  customer_copy: "Copy",
  why_note: "engineer-only note",
  ai_lever: key !== "H1",
  enabled: ["R10", "R11", "R14", "H1"].includes(key),
});

let owner: TestUser;
let businessId: string;

beforeAll(async () => {
  must(
    await s().from("fix_rules").upsert(Object.keys(MAPPING).map(rule), { onConflict: "key", ignoreDuplicates: true }),
  );
  owner = await newUser("pillar-owner");
  await ensureSelfServeWorkspace(owner.db);
  businessId = await createBusinessOnboarding(owner.db, {
    business: {
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
});

describe("rule pillars", () => {
  it("maps every known rule to its pillar", async () => {
    const rows = must(await s().from("fix_rules").select("key, pillar").in("key", Object.keys(MAPPING)));
    expect(Object.fromEntries(rows.map((r) => [r.key, r.pillar]))).toEqual(MAPPING);
  });

  it("a rule inserted without a pillar gets the mapping's; a given pillar is kept; p7 is refused", async () => {
    // fix_rules.key only allows the known keys, so re-insert the disabled placeholder A5 (no fixes).
    const a5 = must(await s().from("fix_rules").select("*").eq("key", "A5").single());
    const reinsert = async (pillar?: string) => {
      must(await s().from("fix_rules").delete().eq("key", "A5"));
      const { pillar: _old, ...row } = a5;
      void _old;
      return must(
        await s()
          .from("fix_rules")
          .insert({ ...row, ...(pillar ? { pillar } : {}) })
          .select("pillar")
          .single(),
      ).pillar;
    };
    expect(await reinsert("p4")).toBe("p4");
    expect(await reinsert()).toBe("p1");
    const bad = await s().from("fix_rules").update({ pillar: "p7" }).eq("key", "A5");
    expect(bad.error?.code).toBe("23514");
    expect(must(await s().from("fix_rules").select("pillar").eq("key", "A5").single()).pillar).toBe("p1");
  });
});

describe("fix pillars", () => {
  it("fixes take their rule's pillar, including the detector's inserts that send none", async () => {
    const run = must(
      await s()
        .from("runs")
        .insert({ business_id: businessId, kind: "weekly", status: "complete", started_at: new Date().toISOString() })
        .select("id")
        .single(),
    ).id;
    await recordFixResults(s(), businessId, run, [
      { rule_key: "R14", result: "fix", evidence: null, detail: "Detail" },
      { rule_key: "R11", result: "fix", evidence: null, detail: "Detail" },
      { rule_key: "H1", result: "fix", evidence: null, detail: "Detail" },
    ]);
    const rows = must(await s().from("fixes").select("rule_key, pillar").eq("business_id", businessId));
    expect(Object.fromEntries(rows.map((r) => [r.rule_key, r.pillar]))).toEqual({ R14: "p5", R11: "p2", H1: "p2" });
  });

  it("a direct insert without a pillar, or with the wrong one, gets the rule's", async () => {
    const insert = (rule_key: string, pillar?: string) =>
      s()
        .from("fixes")
        .insert({ business_id: businessId, rule_key, size: "S", title: "Example", ...(pillar ? { pillar } : {}) })
        .select("pillar")
        .single();
    expect(must(await insert("R6")).pillar).toBe("p3");
    expect(must(await insert("R2", "p6")).pillar).toBe("p3");
  });

  it("listFixes items carry the pillar; H1 stays a tidy-up", async () => {
    const list = await listFixes(owner.db, businessId);
    expect(Object.fromEntries(list.ranked.map((f) => [f.rule_key, f.pillar]))).toMatchObject({ R14: "p5", R11: "p2" });
    expect(list.tidyUps.map((f) => [f.rule_key, f.pillar])).toEqual([["H1", "p2"]]);
  });
});
