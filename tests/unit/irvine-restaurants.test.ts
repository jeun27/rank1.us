import { describe, expect, it } from "vitest";
import {
  IRVINE_RESTAURANT_COLUMNS,
  irvineClusters,
  irvineRestaurants,
  irvineRestaurantsHeader,
  parseCsv,
} from "../fixtures/irvine_restaurants";

describe("Irvine restaurants CSV fixture", () => {
  it("has all 718 rows", () => {
    expect(irvineRestaurants).toHaveLength(718);
  });

  it("keeps exactly the allowed columns", () => {
    expect(irvineRestaurantsHeader).toEqual([...IRVINE_RESTAURANT_COLUMNS]);
  });

  it("has no rating, review, email, instagram, pitch or enrichment columns", () => {
    const banned =
      /rating|review|email|instagram|^ig_|priority|pitch|top150|^enrich_|_source$|^google_name$|^google_address$|^enr_phone$|chain_basis/;
    expect(irvineRestaurantsHeader.filter((h) => banned.test(h))).toEqual([]);
  });

  it("lists distinct, non-empty clusters", () => {
    expect(irvineClusters.length).toBeGreaterThan(0);
    expect(new Set(irvineClusters).size).toBe(irvineClusters.length);
    expect(irvineClusters).toContain("Diamond Jamboree");
    expect(irvineClusters).not.toContain("");
  });

  it("parses quoted commas, quotes and newlines", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
});
