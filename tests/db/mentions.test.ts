import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { listMentionDecisions, setMentionTarget } from "@/lib/queries/mentions";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

// G7 (0030): candidates ("Lists that name your rivals but not you") are computed on read; only the
// users' decisions are stored. Self-serve members or the team on DFY decide; never a dfy_client.
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
const URL = "https://example-eats.test/best-ramen-irvine";

let owner: TestUser;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfyBusiness: string;

beforeAll(async () => {
  owner = await newUser("men-owner");
  await ensureSelfServeWorkspace(owner.db);
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  team = await newUser("men-team");
  client = await newUser("men-client");
  outsider = await newUser("men-outsider");
  const creator = await newUser("men-creator");
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

describe("decisions", () => {
  it("a member adds, replaces and clears a decision; who is stored (service-only) and when", async () => {
    await setMentionTarget(owner.db, ownerBusiness, URL, "added");
    expect(await listMentionDecisions(owner.db, ownerBusiness)).toEqual([
      { url: URL, status: "added", decided_at: expect.any(String) },
    ]);
    const stored = must(
      await s().from("mention_target_decisions").select("decided_by").eq("business_id", ownerBusiness).single(),
    );
    expect(stored.decided_by).toBe(owner.id);
    await setMentionTarget(owner.db, ownerBusiness, URL, "dismissed");
    expect((await listMentionDecisions(owner.db, ownerBusiness)).map((d) => d.status)).toEqual(["dismissed"]);
    await setMentionTarget(owner.db, ownerBusiness, URL, null);
    expect(await listMentionDecisions(owner.db, ownerBusiness)).toEqual([]);
  });

  it("the team decides on DFY; the dfy_client reads but never decides (42501)", async () => {
    await setMentionTarget(team.db, dfyBusiness, URL, "added");
    expect((await listMentionDecisions(client.db, dfyBusiness)).map((d) => d.url)).toEqual([URL]);
    await expect(setMentionTarget(client.db, dfyBusiness, URL, "dismissed")).rejects.toMatchObject({ code: "42501" });
    expect((await listMentionDecisions(team.db, dfyBusiness)).map((d) => d.status)).toEqual(["added"]);
  });

  it("no signed-in user can read decided_by (a raw user id), not even the dfy_client or the team (42501)", async () => {
    for (const db of [client.db, team.db]) {
      const { error } = await db.from("mention_target_decisions").select("decided_by").eq("business_id", dfyBusiness);
      expect(error?.code).toBe("42501");
      const star = await loose(db).from("mention_target_decisions").select("*").eq("business_id", dfyBusiness);
      expect(star.error?.code).toBe("42501");
    }
  });

  it("an outsider and the team on self-serve can't decide (42501) and read nothing", async () => {
    await setMentionTarget(owner.db, ownerBusiness, URL, "added");
    for (const db of [outsider.db, team.db]) {
      await expect(setMentionTarget(db, ownerBusiness, URL, "dismissed")).rejects.toMatchObject({ code: "42501" });
      expect(await listMentionDecisions(db, ownerBusiness)).toEqual([]);
    }
  });

  const bad: [string, string, string | null][] = [
    ["a non-http URL", "ftp://example-eats.test/list", "added"],
    ["text that isn't a URL", "best ramen list", "added"],
    ["a URL over 2000 characters", `https://example-eats.test/${"x".repeat(2000)}`, "added"],
    ["an unknown status", URL, "maybe"],
  ];
  for (const [label, url, status] of bad) {
    it(`refuses ${label} (22023)`, async () => {
      await expect(setMentionTarget(owner.db, ownerBusiness, url, status as "added")).rejects.toMatchObject({
        code: "22023",
      });
    });
  }

  it("nobody writes the table directly (42501)", async () => {
    for (const db of [owner.db, team.db, anonClient()]) {
      const { error } = await loose(db)
        .from("mention_target_decisions")
        .insert({ business_id: ownerBusiness, url: URL, status: "added" });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("the grouped fix rule", () => {
  it("R17 exists, is enabled, sits in p3, and keeps its why_note internal", async () => {
    const rule = must(
      await s().from("fix_rules").select("key, enabled, pillar, title, customer_copy").eq("key", "R17").single(),
    );
    expect(rule).toEqual({
      key: "R17",
      enabled: true,
      pillar: "p3",
      title: "Get on these lists",
      customer_copy: "{n} lists AI cites name {rivals} but not you.",
    });
    const visible = must(await owner.db.from("fix_rules_public").select("*").eq("key", "R17"));
    expect(visible).toHaveLength(1);
    expect(visible[0]).not.toHaveProperty("why_note");
  });
});
