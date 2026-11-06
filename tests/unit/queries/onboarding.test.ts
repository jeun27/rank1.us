import { describe, expect, it } from "vitest";
import { INDUSTRIES } from "@/lib/queries/contactRequests";
import { VERTICAL_FOR_INDUSTRY, VERTICALS } from "@/lib/queries/onboarding";

describe("verticals", () => {
  it("has the 13 values of the Connections brief, without med-spa", () => {
    expect(VERTICALS).toHaveLength(13);
    expect(VERTICALS).not.toContain("med_spa");
  });

  it("maps every contact-us industry onto a vertical", () => {
    expect(INDUSTRIES.map((i) => VERTICAL_FOR_INDUSTRY[i])).toEqual([
      "restaurant",
      "hvac",
      "plumbing",
      "roofing",
      "pest_control",
      "other",
    ]);
  });
});
