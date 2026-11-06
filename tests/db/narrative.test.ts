import { beforeAll, describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { NARRATIVE_MAX_WORDS, getNarrativeWords, setNarrativeWords } from "@/lib/queries/narrative";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// G4 (0028): per-business want/avoid word lists (self-serve members or the team on DFY, never a
// dfy_client). The match is computed on read (lead Q3), so nothing else is stored.
const s = () => serviceClient();

const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};

let owner: TestUser;
let ownerBusiness: string;
let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let dfyBusiness: string;

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
  it(`hold at most ${NARRATIVE_MAX_WORDS} words each`, () => {
    expect(NARRATIVE_MAX_WORDS).toBe(8);
  });

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
    ["more than 8 words", { want: Array.from({ length: 9 }, (_, i) => `word${i}`), avoid: [] }],
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
