import { describe, expect, it } from "vitest";
import { must, newUser, serviceClient } from "./helpers";

// 0031: fix rule R18 (G2's JavaScript-empty homepage), p5, enabled; its why_note stays internal.
describe("fix rule R18", () => {
  it("exists, is enabled, sits in p5, with the lead's copy", async () => {
    const rule = must(
      await serviceClient()
        .from("fix_rules")
        .select("key, enabled, pillar, title, customer_copy")
        .eq("key", "R18")
        .single(),
    );
    expect(rule).toEqual({
      key: "R18",
      enabled: true,
      pillar: "p5",
      title: "Your homepage needs JavaScript to show its text",
      customer_copy: "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer.",
    });
  });

  it("is listed for signed-in users without its why_note", async () => {
    const user = await newUser("r18-reader");
    const rows = must(await user.db.from("fix_rules_public").select("*").eq("key", "R18"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("why_note");
  });
});
