import { beforeAll, describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { recordFixResults, setFixStatus } from "@/lib/queries/fixes";
import { setMentionTarget, upsertMentionFix } from "@/lib/queries/mentions";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// 0033: the one grouped R17 fix ("Get on these lists"), built from a business's 'added' mention
// decisions. Self-serve members or the team on DFY; never a dfy_client. One open R17 at most.
const s = () => serviceClient();
const DETAIL = "2 lists AI cites name Example Noodle Bar but not you.";

const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let creator: TestUser;

const selfServe = async (tag: string) => {
  const user = await newUser(tag);
  await ensureSelfServeWorkspace(user.db);
  const b = await createBusinessOnboarding(user.db, { business, competitors: [], questions: [] });
  return { user, b };
};

const r17 = async (businessId: string) =>
  must(
    await s()
      .from("fixes")
      .select("id, status, detail, evidence, title, pillar")
      .eq("business_id", businessId)
      .eq("rule_key", "R17")
      .order("status"),
  );

beforeAll(async () => {
  team = await newUser("mfix-team");
  client = await newUser("mfix-client");
  outsider = await newUser("mfix-outsider");
  creator = await newUser("mfix-creator");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: creator.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
});

describe("upsert_mention_fix", () => {
  it("does nothing with no added lists; then upserts one R17 with the added URLs; a repeat is a no-op", async () => {
    const { user, b } = await selfServe("mfix-a");
    expect(await upsertMentionFix(user.db, b, DETAIL)).toBeNull();
    expect(await r17(b)).toEqual([]);

    await setMentionTarget(user.db, b, "https://example-eats.test/a", "added");
    await setMentionTarget(user.db, b, "https://example-eats.test/b", "added");
    await setMentionTarget(user.db, b, "https://example-eats.test/c", "dismissed");
    const id = await upsertMentionFix(user.db, b, DETAIL);
    expect(id).toEqual(expect.any(String));
    const [row] = await r17(b);
    expect(row).toMatchObject({ id, status: "todo", detail: DETAIL, title: "Get on these lists", pillar: "p3" });
    expect((row.evidence as { urls: string[] }).urls.sort()).toEqual([
      "https://example-eats.test/a",
      "https://example-eats.test/b",
    ]);

    expect(await upsertMentionFix(user.db, b, DETAIL)).toBe(id);
    expect(await r17(b)).toHaveLength(1);
  });

  it("follows the decisions, and deletes the open R17 when nothing is added", async () => {
    const { user, b } = await selfServe("mfix-b");
    await setMentionTarget(user.db, b, "https://example-eats.test/a", "added");
    await setMentionTarget(user.db, b, "https://example-eats.test/b", "added");
    const id = await upsertMentionFix(user.db, b, DETAIL);
    await setMentionTarget(user.db, b, "https://example-eats.test/b", "dismissed");
    expect(await upsertMentionFix(user.db, b, "1 list AI cites names Example Noodle Bar but not you.")).toBe(id);
    expect(((await r17(b))[0].evidence as { urls: string[] }).urls).toEqual(["https://example-eats.test/a"]);

    await setFixStatus(user.db, id!, "doing");
    await setMentionTarget(user.db, b, "https://example-eats.test/a", null);
    expect(await upsertMentionFix(user.db, b, DETAIL)).toBeNull();
    expect(await r17(b)).toEqual([]);
  });

  it("leaves a done R17 alone, and a new added list then opens a fresh one", async () => {
    const { user, b } = await selfServe("mfix-c");
    await setMentionTarget(user.db, b, "https://example-eats.test/a", "added");
    const id = await upsertMentionFix(user.db, b, DETAIL);
    await setFixStatus(user.db, id!, "done");
    await setMentionTarget(user.db, b, "https://example-eats.test/a", null);
    expect(await upsertMentionFix(user.db, b, DETAIL)).toBeNull();
    expect((await r17(b)).map((f) => f.status)).toEqual(["done"]);

    await setMentionTarget(user.db, b, "https://example-eats.test/d", "added");
    const fresh = await upsertMentionFix(user.db, b, DETAIL);
    expect(fresh).not.toBe(id);
    expect((await r17(b)).map((f) => f.status).sort()).toEqual(["done", "todo"]);
  });

  it("the weekly pass never makes a second open R17", async () => {
    const { user, b } = await selfServe("mfix-d");
    await setMentionTarget(user.db, b, "https://example-eats.test/a", "added");
    const id = await upsertMentionFix(user.db, b, DETAIL);
    const run = async () =>
      must(
        await s()
          .from("runs")
          .insert({ business_id: b, kind: "weekly", status: "complete", started_at: new Date().toISOString() })
          .select("id")
          .single(),
      ).id;
    await recordFixResults(s(), b, await run(), [{ rule_key: "R10", result: "fix", evidence: null, detail: "Detail" }]);
    expect(await r17(b)).toHaveLength(1);
    await recordFixResults(s(), b, await run(), [{ rule_key: "R17", result: "fix", evidence: null, detail: "Detail" }]);
    const rows = await r17(b);
    expect(rows.map((f) => f.id)).toEqual([id]);
  });

  it("the team upserts on DFY; a dfy_client, an outsider and the team on self-serve are refused (42501)", async () => {
    const dfy = await createDfyClient(creator.db, {
      workspace_name: "Example DFY",
      business: { ...business, name: "Example Pho" },
    });
    must(
      await s().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
    );
    await setMentionTarget(team.db, dfy.businessId, "https://example-eats.test/a", "added");
    expect(await upsertMentionFix(team.db, dfy.businessId, DETAIL)).toEqual(expect.any(String));

    const { b } = await selfServe("mfix-e");
    for (const [db, biz] of [
      [client.db, dfy.businessId],
      [outsider.db, b],
      [team.db, b],
    ] as const) {
      await expect(upsertMentionFix(db, biz, DETAIL)).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("refuses an empty or over-long detail (22023)", async () => {
    const { user, b } = await selfServe("mfix-f");
    for (const detail of ["  ", "x".repeat(2001)]) {
      await expect(upsertMentionFix(user.db, b, detail)).rejects.toMatchObject({ code: "22023" });
    }
  });
});
