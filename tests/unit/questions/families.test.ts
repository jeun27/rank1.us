import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_QUESTIONS,
  TEMPLATES,
  buildQuestions,
  youtubeKeyword,
  type Business,
} from "@/lib/questions/templates";

// Onboarding v2 DP3 (share/ux-plan/onboarding-welcome §4, Q10 lead-approved under P3, 2026-11-07).
const none = { landmarks: [], areas: [], dietary: [], occasion: [] };
const plumber = {
  vertical: "plumbing" as const,
  category: "plumber",
  services: ["water heater repair", "drain cleaning"],
  city: "Irvine",
  state: "CA",
};

describe("templates for every business type", () => {
  it("the 12 Q10 templates exist, after the 20 restaurant ones, in §4's order", () => {
    expect(TEMPLATES.filter((t) => t.family === "restaurant")).toHaveLength(20);
    expect(TEMPLATES.filter((t) => t.family !== "restaurant").map((t) => [t.family, t.short_form])).toEqual([
      ["local", "best {category} in {city}"],
      ["local", "{service} in {city}"],
      ["local", "emergency {category} near me in {city}"],
      ["local", "affordable {service} in {city}"],
      ["local", "{category} with good reviews in {city}"],
      ["local", "who does {service} near {area}"],
      ["dtc", "best {category} brands"],
      ["dtc", "where to buy {service}"],
      ["dtc", "{category} brands like {competitor}"],
      ["saas", "best {category} software"],
      ["saas", "{category} tools for small businesses"],
      ["saas", "alternatives to {competitor}"],
    ]);
  });

  it("each family yields ≤ the total, no {placeholder} left, and only its own templates", () => {
    const cases = [
      [{ cuisine: "ramen", city: "Irvine", state: "CA" }, "restaurant"],
      [plumber, "local"],
      [
        { vertical: "beauty" as const, category: "day spa", services: ["facials"], city: "Irvine", state: "CA" },
        "local",
      ],
      [{ vertical: "dtc" as const, category: "wool socks", services: ["hiking socks"], city: "", state: "" }, "dtc"],
      [{ vertical: "saas" as const, category: "CRM", city: "", state: "" }, "saas"],
    ] as [Business, string][];
    for (const [business, family] of cases) {
      const qs = buildQuestions(business, { ...none, competitors: ["Example Rival"] });
      expect(qs.length, family).toBeGreaterThan(0);
      expect(qs.length).toBeLessThanOrEqual(MAX_ACTIVE_QUESTIONS);
      // BE3 reconciles by key: stable and unique within one card's output.
      expect(new Set(qs.map((q) => q.key)).size, family).toBe(qs.length);
      expect(buildQuestions(business, { ...none, competitors: ["Example Rival"] }).map((q) => q.key)).toEqual(
        qs.map((q) => q.key),
      );
      for (const q of qs) {
        expect(`${q.short_text} ${q.long_text}`).not.toMatch(/\{\w+\}/);
        expect(TEMPLATES.find((t) => t.sort === q.template_sort)!.family).toBe(family);
      }
    }
  });

  it("emergency is trades only (hvac, plumbing, roofing, pest_control, auto)", () => {
    const has = (b: object) =>
      buildQuestions(b as typeof plumber, none).some((q) => q.short_text.startsWith("emergency"));
    expect(has(plumber)).toBe(true);
    expect(has({ ...plumber, vertical: "dental", category: "dentist" })).toBe(false);
  });

  it("no area/landmark template without areas; one question per service", () => {
    const qs = buildQuestions(plumber, none).map((q) => q.short_text);
    expect(qs.some((q) => q.startsWith("who does"))).toBe(false);
    expect(qs).toContain("water heater repair in Irvine");
    expect(qs).toContain("drain cleaning in Irvine");
    const withAreas = buildQuestions(plumber, { ...none, areas: ["Woodbridge"] }).map((q) => q.short_text);
    expect(withAreas).toContain("who does water heater repair near Woodbridge");
  });

  it("missing slots skip the template instead of throwing (no category, no services, no competitor)", () => {
    expect(buildQuestions({ vertical: "saas", city: "", state: "" }, none)).toEqual([]);
    const qs = buildQuestions({ ...plumber, services: [] }, none).map((q) => q.short_text);
    expect(qs).toEqual([
      "best plumber in Irvine",
      "emergency plumber near me in Irvine",
      "plumber with good reviews in Irvine",
    ]);
  });

  it("restaurants are unchanged (no vertical = restaurant)", () => {
    const a = buildQuestions({ cuisine: "ramen", city: "Irvine", state: "CA" }, none);
    expect(a.every((q) => TEMPLATES.find((t) => t.sort === q.template_sort)!.family === "restaurant")).toBe(true);
  });
});

describe("youtubeKeyword (G1, §4)", () => {
  it("local: the first service + city; no services → category + city", () => {
    expect(youtubeKeyword(plumber)).toBe("water heater repair Irvine");
    expect(youtubeKeyword({ ...plumber, services: [] })).toBe("plumber Irvine");
  });
  it("restaurant: {cuisine} {city}", () => {
    expect(youtubeKeyword({ vertical: "restaurant", cuisine: "ramen", city: "Irvine", state: "CA" })).toBe(
      "ramen Irvine",
    );
    expect(youtubeKeyword({ cuisine: " ramen ", city: "Irvine", state: "CA" })).toBe("ramen Irvine");
  });
  it("saas/dtc: the category, no city", () => {
    expect(youtubeKeyword({ vertical: "saas", category: "CRM", city: "Irvine", state: "CA" })).toBe("CRM");
    expect(youtubeKeyword({ vertical: "dtc", category: "wool socks", services: ["x"], city: "", state: "" })).toBe(
      "wool socks",
    );
  });
  it("nothing to build it from → null (no keyword, no G1 rows)", () => {
    expect(youtubeKeyword({ vertical: "restaurant", cuisine: null, city: "Irvine", state: "CA" })).toBeNull();
    expect(youtubeKeyword({ vertical: "saas", category: "  ", city: "", state: "" })).toBeNull();
    expect(youtubeKeyword({ vertical: "plumbing", city: "Irvine", state: "CA" })).toBeNull();
  });
});
