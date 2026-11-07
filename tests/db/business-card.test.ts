import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { saveBusinessCard, type BusinessCard } from "@/lib/queries/business-card";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { buildQuestions, type KeyedQuestion, type Picks } from "@/lib/questions/templates";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// 0044 (BE3): saving the business card reconciles its questions in one transaction. Generated rows keep
// their template output; a row whose text differs from it (edited) or that has no template_key
// (hand-added) is never touched. Rows are never deleted, so answer/run history keeps its question ids.
const s = () => serviceClient();
const PICKS: Picks = { landmarks: [], areas: [], dietary: ["vegan"], occasion: [] };

const card = (extra: Partial<BusinessCard> = {}): BusinessCard => ({
  name: "Example Pho Spot",
  vertical: "restaurant",
  cuisine: "pho",
  city: "Irvine",
  state: "CA",
  question_picks: PICKS,
  ...extra,
});

async function business(tag: string) {
  const user = await newUser(tag);
  await ensureSelfServeWorkspace(user.db);
  const id = await createBusinessOnboarding(user.db, {
    business: {
      name: "Example Pho Spot",
      domain: `${tag}-${randomUUID().slice(0, 8)}.test`,
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
  return { user, id };
}

const rows = async (businessId: string) =>
  must(await s().from("questions").select("*").eq("business_id", businessId).order("id"));
const keysOf = (c: BusinessCard) => buildQuestions(c as never, c.question_picks).map((q) => q.key);

describe("save_business_card", () => {
  it("on a business with no questions it inserts the builder output, with its template text stored", async () => {
    const { user, id } = await business("bc-first");
    await saveBusinessCard(user.db, id, card());
    const built = buildQuestions({ cuisine: "pho", city: "Irvine", state: "CA" }, PICKS);
    const qs = await rows(id);
    expect(qs.map((q) => q.template_key).sort()).toEqual(built.map((q) => q.key).sort());
    for (const q of qs) {
      expect(q.template_short).toBe(q.short_text);
      expect(q.template_long).toBe(q.long_text);
    }
    expect(qs.filter((q) => q.active)).toHaveLength(Math.min(built.length, 25));
    const [b] = must(await s().from("businesses").select("question_picks").eq("id", id));
    expect(b.question_picks).toEqual(PICKS);
  });

  it("a city change rewrites unedited rows in place: same ids, so history keeps its question ids", async () => {
    const { user, id } = await business("bc-city");
    await saveBusinessCard(user.db, id, card());
    const before = await rows(id);
    const kept = keysOf(card({ city: "Tustin" }));
    const q = before.find((r) => r.active && kept.includes(r.template_key!))!;
    const run = must(
      await s().from("runs").insert({ business_id: id, kind: "audit", status: "complete" }).select("id").single(),
    ).id;
    const answer = must(
      await s()
        .from("answers")
        .insert({
          run_id: run,
          question_id: q.id,
          engine: "chatgpt",
          run_index: 1,
          question_text_used: q.short_text,
          status: "ok",
          mentioned: false,
        })
        .select("id")
        .single(),
    ).id;

    await saveBusinessCard(user.db, id, card({ city: "Tustin" }));
    const after = await rows(id);
    const moved = after.find((r) => r.id === q.id)!;
    expect(moved.template_key).toBe(q.template_key);
    expect(moved.short_text).toContain("Tustin");
    expect(moved.template_short).toBe(moved.short_text);
    expect(must(await s().from("answers").select("question_id").eq("id", answer).single()).question_id).toBe(q.id);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  it("edited and hand-added rows are byte-identical after a save", async () => {
    const { user, id } = await business("bc-owner");
    await saveBusinessCard(user.db, id, card());
    const target = (await rows(id)).find((r) => r.active)!;
    must(await user.db.from("questions").update({ short_text: "my own wording" }).eq("id", target.id));
    const hand = must(
      await user.db
        .from("questions")
        .insert({ business_id: id, short_text: "hand-added question", location_level: "country", active: false })
        .select("id")
        .single(),
    ).id;
    const owned = (await rows(id)).filter((r) => r.id === target.id || r.id === hand);

    await saveBusinessCard(user.db, id, card({ city: "Tustin", cuisine: "ramen" }));
    expect((await rows(id)).filter((r) => r.id === target.id || r.id === hand)).toEqual(owned);
  });

  it("a cuisine change deactivates unedited rows that no longer apply, never deletes, and inserts the new keys", async () => {
    const { user, id } = await business("bc-cuisine");
    await saveBusinessCard(user.db, id, card());
    const before = await rows(id);
    const next = card({ cuisine: "ramen", city: "Tustin" });
    await saveBusinessCard(user.db, id, next);
    const after = await rows(id);
    const keys = new Set(keysOf(next));

    expect(after.map((r) => r.id)).toEqual(expect.arrayContaining(before.map((r) => r.id)));
    for (const r of after) if (!keys.has(r.template_key!)) expect(r.active, r.short_text).toBe(false);
    for (const k of keys) expect(after.filter((r) => r.template_key === k)).toHaveLength(1);
    const active = after.filter((r) => r.active).length;
    expect(active).toBeGreaterThan(0);
    expect(active).toBeLessThanOrEqual(25);
  });

  // Lead Q4: a 2-type fixture template set stands in for DP3, so the type switch is tested now.
  const fixture = (c: BusinessCard): KeyedQuestion[] =>
    c.vertical === "restaurant"
      ? Array.from({ length: 12 }, (_, i) => ({
          key: `${i + 1}`,
          short_text: `best ${c.cuisine} ${i} in ${c.city}`,
          long_text: `r${i}`,
        }))
      : Array.from({ length: 30 }, (_, i) => ({
          key: `ls${i + 1}`,
          short_text: `best plumber ${i} in ${c.city}`,
          long_text: `l${i}`,
        }));

  it("Restaurant → Local service: old unedited rows off (kept), the new type's rows on, owner rows untouched", async () => {
    const { user, id } = await business("bc-type");
    await saveBusinessCard(user.db, id, card(), fixture);
    const first = await rows(id);
    must(await user.db.from("questions").update({ short_text: "my own pho question" }).eq("id", first[0].id));
    const owned = (await rows(id)).find((r) => r.id === first[0].id);

    await saveBusinessCard(user.db, id, card({ vertical: "plumbing", cuisine: null }), fixture);
    const after = await rows(id);
    expect(after.find((r) => r.id === first[0].id)).toEqual(owned);
    const oldRows = after.filter((r) => /^\d+$/.test(r.template_key ?? "") && r.id !== first[0].id);
    expect(oldRows).toHaveLength(11);
    expect(oldRows.every((r) => !r.active)).toBe(true);
    const newRows = after.filter((r) => r.template_key?.startsWith("ls"));
    expect(newRows).toHaveLength(30);
    // 25 slots: the edited row keeps one, the first 24 plumbing rows take the rest, in template order.
    expect(
      newRows
        .filter((r) => r.active)
        .map((r) => r.template_key)
        .sort(),
    ).toEqual(Array.from({ length: 24 }, (_, i) => `ls${i + 1}`).sort());
    expect(after.filter((r) => r.active)).toHaveLength(25);

    // And back: the restaurant rows come back on in place (same ids), the plumbing rows go off.
    await saveBusinessCard(user.db, id, card(), fixture);
    const back = await rows(id);
    expect(back.filter((r) => r.active && oldRows.some((o) => o.id === r.id))).toHaveLength(11);
    expect(back.filter((r) => r.active && r.template_key?.startsWith("ls"))).toHaveLength(0);
  });

  it("the 25 cap keeps owner rows active first; new template rows beyond it are inserted inactive", async () => {
    const { user, id } = await business("bc-cap");
    const hand = Array.from({ length: 20 }, (_, i) => ({
      business_id: id,
      short_text: `hand question ${i}`,
      location_level: "city",
      city: "Irvine",
    }));
    must(await user.db.from("questions").insert(hand));
    await saveBusinessCard(user.db, id, card());
    const qs = await rows(id);
    expect(qs.filter((r) => r.template_key === null).every((r) => r.active)).toBe(true);
    expect(qs.filter((r) => r.active)).toHaveLength(25);
    expect(qs.filter((r) => r.template_key !== null && r.active)).toHaveLength(5);
    // The 5 active template rows are the first in template order.
    const order = keysOf(card());
    const activeKeys = qs.filter((r) => r.template_key !== null && r.active).map((r) => r.template_key);
    expect(activeKeys.sort()).toEqual(order.slice(0, 5).sort());
  });

  it("stores the card fields and refuses bad picks (23514), also on a direct update", async () => {
    const { user, id } = await business("bc-fields");
    await saveBusinessCard(
      user.db,
      id,
      card({ name: "Example Pho Spot 2", phone: "+1 949 555 0100", services: ["Pho"] }),
    );
    const [b] = must(await s().from("businesses").select("name, phone, services, domain").eq("id", id));
    expect(b).toMatchObject({ name: "Example Pho Spot 2", phone: "+1 949 555 0100", services: ["Pho"] });
    const bad = { landmarks: [], areas: [], dietary: [" "], occasion: [] };
    await expect(saveBusinessCard(user.db, id, card({ question_picks: bad }))).rejects.toMatchObject({ code: "23514" });
    const direct = await user.db
      .from("businesses")
      .update({ question_picks: { colors: ["red"] } })
      .eq("id", id);
    expect(direct.error?.code).toBe("23514");
  });

  it("another user can't save someone else's card (42501), and nothing changes", async () => {
    const { user, id } = await business("bc-rls");
    await saveBusinessCard(user.db, id, card());
    const before = await rows(id);
    const other: TestUser = await newUser("bc-stranger");
    await expect(saveBusinessCard(other.db, id, card({ city: "Tustin" }))).rejects.toMatchObject({ code: "42501" });
    expect(await rows(id)).toEqual(before);
  });
});
