import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  NARRATIVE_SNIPPET_MAX,
  getLatestNarrativeResult,
  getNarrativeWords,
  recordNarrativeResult,
  setNarrativeWords,
  type NarrativeResultInput,
} from "@/lib/queries/narrative";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

// G4 (0028): per-business want/avoid word lists (self-serve members or the team on DFY, never a
// dfy_client) and one stored word-match result per run, whose snippet must be stored answer text.
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
const ANSWER = "Example Ramen House is a cozy spot with rich tonkotsu broth, but it can feel pricey for lunch.";

let owner: TestUser;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfyBusiness: string;

async function runWithAnswer(businessId: string, kind = "weekly") {
  const run = must(
    await s()
      .from("runs")
      .insert({ business_id: businessId, kind, status: "complete", started_at: new Date().toISOString() })
      .select("id")
      .single(),
  ).id as string;
  must(
    await s().from("answers").insert({
      run_id: run,
      engine: "chatgpt",
      run_index: 1,
      status: "ok",
      text: ANSWER,
      mentioned: true,
      question_text_used: "best ramen in Irvine",
    }),
  );
  return run;
}

const result = (extra: Partial<NarrativeResultInput> = {}): NarrativeResultInput => ({
  want: [{ word: "cozy", count: 1 }],
  avoid: [{ word: "pricey", count: 1 }],
  n: 1,
  snippet: "a cozy spot with rich tonkotsu broth",
  snippetWord: "cozy",
  ...extra,
});

beforeAll(async () => {
  owner = await newUser("nar-owner");
  await ensureSelfServeWorkspace(owner.db);
  ownerBusiness = await createBusinessOnboarding(owner.db, { business, competitors: [], questions: [] });
  team = await newUser("nar-team");
  client = await newUser("nar-client");
  outsider = await newUser("nar-outsider");
  const creator = await newUser("nar-creator");
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

describe("word lists", () => {
  it("start empty; members set them, trimmed, lowercased and deduped in order", async () => {
    expect(await getNarrativeWords(owner.db, ownerBusiness)).toEqual({ want: [], avoid: [] });
    await setNarrativeWords(owner.db, ownerBusiness, {
      want: ["  Cozy ", "cozy", "Late Night", ""],
      avoid: ["Pricey"],
    });
    expect(await getNarrativeWords(owner.db, ownerBusiness)).toEqual({
      want: ["cozy", "late night"],
      avoid: ["pricey"],
    });
  });

  it("the team sets them on DFY; the dfy_client reads but never sets (42501)", async () => {
    await setNarrativeWords(team.db, dfyBusiness, { want: ["fresh"], avoid: [] });
    expect(await getNarrativeWords(client.db, dfyBusiness)).toEqual({ want: ["fresh"], avoid: [] });
    await expect(setNarrativeWords(client.db, dfyBusiness, { want: ["x1"], avoid: [] })).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("an outsider and the team on self-serve can't set them (42501), and read nothing", async () => {
    for (const db of [outsider.db, team.db]) {
      await expect(setNarrativeWords(db, ownerBusiness, { want: ["x1"], avoid: [] })).rejects.toMatchObject({
        code: "42501",
      });
      expect(await getNarrativeWords(db, ownerBusiness)).toBeNull();
    }
  });

  const bad: [string, { want: string[]; avoid: string[] }][] = [
    ["a word in both lists", { want: ["cozy"], avoid: [" COZY"] }],
    ["more than 20 words", { want: Array.from({ length: 21 }, (_, i) => `word${i}`), avoid: [] }],
    ["a 1-character word", { want: ["a"], avoid: [] }],
    ["a word over 40 characters", { want: ["x".repeat(41)], avoid: [] }],
  ];
  for (const [label, words] of bad) {
    it(`refuses ${label} (22023) and keeps the old lists`, async () => {
      const before = await getNarrativeWords(owner.db, ownerBusiness);
      await expect(setNarrativeWords(owner.db, ownerBusiness, words)).rejects.toMatchObject({ code: "22023" });
      expect(await getNarrativeWords(owner.db, ownerBusiness)).toEqual(before);
    });
  }

  it("members can't write the columns directly, and the CHECKs refuse bad direct writes", async () => {
    const direct = await owner.db
      .from("businesses")
      .update({ narrative_want: ["sneaky"] })
      .eq("id", ownerBusiness);
    expect(direct.error?.code).toBe("42501");
    const service = await s()
      .from("businesses")
      .update({ narrative_want: ["Not Lower"] })
      .eq("id", ownerBusiness);
    expect(service.error?.code).toBe("23514");
  });
});

describe("match results", () => {
  it("stores one result per run; members, the team on DFY and the dfy_client read the latest", async () => {
    const r = await runWithAnswer(ownerBusiness);
    await recordNarrativeResult(s(), r, result());
    await recordNarrativeResult(s(), r, result({ n: 2, want: [{ word: "cozy", count: 2 }] }));
    expect(must(await s().from("narrative_results").select("n").eq("run_id", r))).toEqual([{ n: 2 }]);
    expect(await getLatestNarrativeResult(owner.db, ownerBusiness)).toMatchObject({
      run_id: r,
      n: 2,
      snippet: "a cozy spot with rich tonkotsu broth",
      snippet_word: "cozy",
    });
    expect(await getLatestNarrativeResult(outsider.db, ownerBusiness)).toBeNull();

    const d = await runWithAnswer(dfyBusiness);
    await recordNarrativeResult(
      s(),
      d,
      result({ want: [{ word: "fresh", count: 0 }], avoid: [], snippet: null, snippetWord: null }),
    );
    for (const db of [team.db, client.db])
      expect(await getLatestNarrativeResult(db, dfyBusiness)).toMatchObject({ run_id: d });
  });

  it(`refuses a snippet over ${NARRATIVE_SNIPPET_MAX} characters, or one that isn't stored answer text (22023)`, async () => {
    const r = await runWithAnswer(ownerBusiness);
    const long = "cozy ".repeat(90);
    await expect(recordNarrativeResult(s(), r, result({ snippet: long }))).rejects.toMatchObject({ code: "22023" });
    await expect(
      recordNarrativeResult(s(), r, result({ snippet: "a cozy spot, says the why_note" })),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("refuses a snippet word that isn't in the snippet or the lists, and counts over n (22023)", async () => {
    const r = await runWithAnswer(ownerBusiness);
    for (const patch of [
      { snippetWord: "broth" },
      { snippetWord: "pricey" },
      { want: [{ word: "cozy", count: 5 }] },
      { want: [{ word: "unknown", count: 1 }] },
    ]) {
      await expect(recordNarrativeResult(s(), r, result(patch))).rejects.toMatchObject({ code: "22023" });
    }
  });

  it("a free audit's result is service-only; users can't write results (42501)", async () => {
    const r = await runWithAnswer(ownerBusiness, "free_audit");
    await recordNarrativeResult(s(), r, result());
    expect(must(await owner.db.from("narrative_results").select("run_id").eq("run_id", r))).toEqual([]);
    for (const db of [owner.db, team.db, anonClient()]) {
      await expect(recordNarrativeResult(db, r, result())).rejects.toMatchObject({ code: "42501" });
      const { error } = await loose(db).from("narrative_results").insert({ run_id: r, n: 0 });
      expect(error?.code).toBe("42501");
    }
  });
});
