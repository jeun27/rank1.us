import { describe, expect, it } from "vitest";
import { withdrawFixes } from "@/lib/queries/fixes";
import { anonClient, makeWorkspace, must, newUser, serviceClient } from "./helpers";

// 0037: withdraw_fixes deletes only todo YouTube fixes (R19-R21) of one business, for the weekly pass
// when a business isn't youtubeReady. Doing and done are kept. Service role only.
const s = () => serviceClient();

async function fix(businessId: string, rule_key: string, status: "todo" | "doing" | "done") {
  return must(
    await s()
      .from("fixes")
      .insert({ business_id: businessId, rule_key, size: "S", title: "Example", detail: "Detail", status })
      .select("id")
      .single(),
  ).id as string;
}
const exists = async (id: string) => must(await s().from("fixes").select("id").eq("id", id)).length === 1;

describe("withdraw_fixes", () => {
  it("deletes only the todo YouTube fixes of that business and returns the count", async () => {
    const owner = await newUser("wd-owner");
    const { businessId } = await makeWorkspace(owner);
    const other = (await makeWorkspace(await newUser("wd-other"))).businessId;
    const todo = await fix(businessId, "R19", "todo");
    const doing = await fix(businessId, "R20", "doing");
    const done = await fix(businessId, "R21", "done");
    // R16 comes from a migration, so it exists even after the migrations test drops the seed.
    const notYoutube = await fix(businessId, "R16", "todo");
    const otherTodo = await fix(other, "R19", "todo");

    expect(await withdrawFixes(s(), businessId, ["R19", "R20", "R21"])).toBe(1);
    expect(await exists(todo)).toBe(false);
    for (const id of [doing, done, notYoutube, otherTodo]) expect(await exists(id)).toBe(true);
    expect(await withdrawFixes(s(), businessId, ["R19", "R20", "R21"])).toBe(0);
  });

  it("refuses a non-YouTube rule key (22023) and deletes nothing", async () => {
    const { businessId } = await makeWorkspace(await newUser("wd-bad"));
    const keep = await fix(businessId, "R19", "todo");
    for (const keys of [["R16"], ["R19", "R16"], []]) {
      await expect(withdrawFixes(s(), businessId, keys)).rejects.toMatchObject({ code: "22023" });
    }
    expect(await exists(keep)).toBe(true);
  });

  it("refuses signed-in users and anon (42501)", async () => {
    const owner = await newUser("wd-user");
    const { businessId } = await makeWorkspace(owner);
    for (const db of [owner.db, anonClient()]) {
      await expect(withdrawFixes(db, businessId, ["R19"])).rejects.toMatchObject({ code: "42501" });
    }
  });
});
