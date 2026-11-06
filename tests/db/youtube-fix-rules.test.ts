import { describe, expect, it } from "vitest";
import { must, newUser, serviceClient } from "./helpers";

// 0035: the YouTube (G1) fix rules, one grouped fix per check (lead Q1): R19 keyword in the title,
// R20 keyword in the first lines of the description, R21 chapters on videos 5 minutes or longer.
const RULES = {
  R19: {
    title: "Put your keyword in your video titles",
    customer_copy: "{n} videos need your keyword in the title.",
  },
  R20: {
    title: "Put your keyword in the first lines of the description",
    customer_copy: "{n} videos don't have your keyword in the first lines of the description.",
  },
  R21: {
    title: "Add chapters on videos 5 minutes or longer",
    customer_copy: "{n} videos 5 minutes or longer have no chapters.",
  },
};

describe("YouTube fix rules", () => {
  it("R19-R21 exist, are enabled, sit in p4, with the lead's copy", async () => {
    const rows = must(
      await serviceClient()
        .from("fix_rules")
        .select("key, enabled, pillar, size, title, customer_copy")
        .in("key", Object.keys(RULES))
        .order("key"),
    );
    expect(rows).toEqual(
      Object.entries(RULES).map(([key, r]) => ({ key, enabled: true, pillar: "p4", size: "S", ...r })),
    );
  });

  it("are listed for signed-in users without their why_note", async () => {
    const user = await newUser("yt-reader");
    const rows = must(await user.db.from("fix_rules_public").select("*").in("key", Object.keys(RULES)));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).not.toHaveProperty("why_note");
  });
});
