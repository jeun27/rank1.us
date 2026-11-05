import { describe, expect, it } from "vitest";
import { detectMentions, jobBrands, normalize, type MentionBrand as TrackedBrand } from "@/lib/runs/mentions";

const business: TrackedBrand = {
  kind: "business",
  name: "Example Ramen House",
  aliases: ["ERH"],
  domain: "example-ramen-house.test",
};
const noodle: TrackedBrand = { kind: "competitor", name: "Example Noodle Bar", domain: "www.examplenoodles.test" };
const izakaya: TrackedBrand = { kind: "competitor", name: "Example Izakaya" };
const cafe: TrackedBrand = { kind: "competitor", name: "Café Éxample" };
const ampersand: TrackedBrand = { kind: "competitor", name: "Example Rice & Broth" };
const short: TrackedBrand = { kind: "competitor", name: "Ramen House" };
const brands = [business, noodle, izakaya];

describe("normalize", () => {
  it("folds case, diacritics, curly quotes, & and whitespace", () => {
    expect(normalize("  Café  Éxample’s “Best” Rice & Broth ")).toBe('cafe example\'s "best" rice and broth');
  });
});

describe("detectMentions", () => {
  it("finds the business and orders brands by first appearance", () => {
    const m = detectMentions(
      "Try Example Noodle Bar first, then Example Ramen House. Example Noodle Bar again.",
      brands,
    );
    expect(m).toEqual({
      mentioned: true,
      first_position: 2,
      brands: [
        { name: "Example Ramen House", kind: "business", mentioned: true, position: 2 },
        { name: "Example Noodle Bar", kind: "competitor", mentioned: true, position: 1 },
        { name: "Example Izakaya", kind: "competitor", mentioned: false, position: null },
      ],
    });
  });

  it("not mentioned → mentioned false, first_position null", () => {
    const m = detectMentions("Example Izakaya is the pick.", brands);
    expect(m.mentioned).toBe(false);
    expect(m.first_position).toBeNull();
    expect(m.brands.find((b) => b.name === "Example Izakaya")).toMatchObject({ mentioned: true, position: 1 });
  });

  it("matches aliases", () => {
    expect(detectMentions("Locals love ERH for tonkotsu.", brands).mentioned).toBe(true);
    expect(detectMentions("Locals love HERHOUSE.", brands).mentioned).toBe(false);
  });

  it("ignores case and diacritics", () => {
    expect(detectMentions("EXAMPLE RAMEN HOUSE is open late", brands).mentioned).toBe(true);
    expect(detectMentions("Try cafe example for coffee", [cafe]).brands[0].mentioned).toBe(true);
    expect(detectMentions("Try Café Éxample", [{ ...cafe, name: "Cafe Example" }]).brands[0].mentioned).toBe(true);
  });

  it("matches possessives with straight or curly apostrophes", () => {
    expect(detectMentions("Example Ramen House's broth is rich.", brands).mentioned).toBe(true);
    expect(detectMentions("Example Ramen House’s broth is rich.", brands).mentioned).toBe(true);
  });

  it("treats & and 'and' as the same", () => {
    expect(detectMentions("Example Rice and Broth is great", [ampersand]).brands[0].mentioned).toBe(true);
    expect(
      detectMentions("Example Rice & Broth is great", [{ ...ampersand, name: "Example Rice and Broth" }]).brands[0]
        .mentioned,
    ).toBe(true);
    expect(detectMentions("Example Rice&Broth is great", [ampersand]).brands[0].mentioned).toBe(true);
  });

  it("no substring false positives", () => {
    expect(detectMentions("Ramen is the best food in Irvine.", [short]).brands[0].mentioned).toBe(false);
    expect(detectMentions("Example Ramen Houses are everywhere", brands).mentioned).toBe(false);
    expect(detectMentions("NotExample Ramen House", brands).mentioned).toBe(false);
  });

  it("a shorter brand inside a longer one doesn't count", () => {
    const m = detectMentions("Example Ramen House is the best.", [business, short]);
    expect(m.brands.map((b) => b.mentioned)).toEqual([true, false]);
    expect(detectMentions("Ramen House on Main St.", [business, short]).brands.map((b) => b.mentioned)).toEqual([
      false,
      true,
    ]);
  });

  it("counts domain mentions: the bare domain, and a distinctive label", () => {
    expect(detectMentions("See example-ramen-house.test for the menu.", brands).mentioned).toBe(true);
    expect(detectMentions("Order at https://www.example-ramen-house.test/menu", brands).mentioned).toBe(true);
    expect(detectMentions("Everyone mentions examplenoodles lately.", brands).brands[1].mentioned).toBe(true);
  });

  it("skips non-distinctive labels: stoplisted words or under 5 characters", () => {
    const generic: TrackedBrand = { kind: "business", name: "Example Shop A", domain: "ramen-house.test" };
    expect(detectMentions("great ramen house nearby", [generic]).mentioned).toBe(false);
    const tiny: TrackedBrand = { kind: "business", name: "Example Shop B", domain: "abc.test" };
    expect(detectMentions("abc is a word", [tiny]).mentioned).toBe(false);
    expect(detectMentions("visit abc.test", [tiny]).mentioned).toBe(true);
  });

  it("empty or missing text: nothing mentioned", () => {
    for (const t of ["", null, undefined]) {
      const m = detectMentions(t, brands);
      expect(m.mentioned).toBe(false);
      expect(m.brands.every((b) => !b.mentioned && b.position === null)).toBe(true);
    }
  });
});

describe("jobBrands", () => {
  it("puts the claimed business first as 'business', then competitors in claim order", () => {
    const b = { id: "b", name: "Example Ramen House", aliases: [], domain: null };
    const c = [
      { id: "c1", name: "Example Izakaya", aliases: ["EI"], domain: "example-izakaya.test" },
      { id: "c2", name: "Example Noodle Bar", aliases: [], domain: null },
    ];
    expect(jobBrands({ business: b, competitors: c }).map((x) => [x.kind, x.name])).toEqual([
      ["business", "Example Ramen House"],
      ["competitor", "Example Izakaya"],
      ["competitor", "Example Noodle Bar"],
    ]);
  });
});
