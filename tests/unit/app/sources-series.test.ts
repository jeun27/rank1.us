import { describe, expect, it } from "vitest";
import { SERIES_STYLE } from "@/components/app/SourcesView";

// v3 chart colours (lead, O1): 3 solids + 3 stripes in BOTH themes, from dedicated per-theme tokens.
// Supersedes Step 9 Q3 O1 (4 solid + 2 striped), which failed the validator on the v3 dark panel.
describe("Sources series styles", () => {
  it("3 solid series on series1-3, 3 striped (blue, orange, neutral)", () => {
    expect(SERIES_STYLE).toEqual({
      reddit: { fill: "var(--color-series1)" },
      youtube: { fill: "var(--color-series2)" },
      review_directory: { fill: "var(--color-series3)" },
      social: { fill: "var(--color-series1)", texture: true },
      news_blog: { fill: "var(--color-series2)", texture: true },
      other: { fill: "var(--color-inkMuted)", texture: true },
    });
  });
});
