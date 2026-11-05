import { describe, expect, it } from "vitest";
import { CUISINES, suggestQuestions } from "@/lib/onboarding";
import { MAX_ACTIVE_QUESTIONS, TEMPLATES, buildQuestions } from "@/lib/questions/templates";
import {
  exampleRamenHouse,
  exampleRamenHousePicks,
  exampleRamenHouseQuestions,
} from "../../fixtures/example-ramen-house";

describe("CUISINES", () => {
  it("starts with every template fixed_cuisine, in template order, and has no duplicates", () => {
    const fixed = TEMPLATES.flatMap((t) => (t.fixed_cuisine ? [t.fixed_cuisine] : []));
    expect(CUISINES.slice(0, fixed.length)).toEqual(fixed);
    expect(new Set(CUISINES.map((c) => c.toLowerCase())).size).toBe(CUISINES.length);
  });
});

describe("suggestQuestions", () => {
  it("is buildQuestions for the business and picks (Example Ramen House: 25)", () => {
    const qs = suggestQuestions({ business: exampleRamenHouse, picks: exampleRamenHousePicks });
    expect(qs).toEqual(exampleRamenHouseQuestions);
    expect(qs).toHaveLength(MAX_ACTIVE_QUESTIONS);
  });

  it("never returns more than 25, and fewer when picks are thin", () => {
    const empty = { landmarks: [], areas: [], dietary: [], occasion: [] };
    const qs = suggestQuestions({ business: { cuisine: "tacos", city: "Irvine", state: "CA" }, picks: empty });
    expect(qs).toEqual(buildQuestions({ cuisine: "tacos", city: "Irvine", state: "CA" }, empty));
    expect(qs.length).toBeLessThanOrEqual(MAX_ACTIVE_QUESTIONS);
  });
});
