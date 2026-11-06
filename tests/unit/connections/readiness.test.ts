import { describe, expect, it } from "vitest";
import { LIVE_CONNECTORS, readinessSet, recommend } from "@/lib/connections/recommend";
import { VERTICALS } from "@/lib/queries/onboarding";

// G3 (lead B1): "ready" counts the Recommended connectors that have a live connect flow. Coming-soon
// connectors never block readiness; an empty set is never ready (refresh_gas_ready).
describe("readinessSet", () => {
  it("is Recommended ∩ live for each vertical", () => {
    expect(readinessSet("restaurant")).toEqual(["gbp"]);
    expect(readinessSet("saas")).toEqual(["search_console"]);
    expect(readinessSet("dtc")).toEqual(["search_console"]);
    expect(readinessSet("events")).toEqual(["gbp"]);
    expect(readinessSet("other")).toEqual([]);
  });

  it("never includes a coming-soon connector, for every vertical", () => {
    for (const v of VERTICALS) {
      const set = readinessSet(v);
      expect(
        set.every((c) => LIVE_CONNECTORS.includes(c)),
        v,
      ).toBe(true);
      expect(set).toEqual(
        recommend(v)
          .recommended.filter((t) => t.available === "live")
          .map((t) => t.connector),
      );
    }
  });
});
