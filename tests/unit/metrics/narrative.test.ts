import { describe, expect, it } from "vitest";
import { matchNarrative, NARRATIVE_MIN_ANSWERS, WINDOW, type NarrativeAnswer } from "@/lib/metrics/narrative";

// Example data only.
const NAMES = ["Example Ramen House", "Ex Ramen"];
let k = 0;
const ans = (text: string | null, o: Partial<NarrativeAnswer> = {}): NarrativeAnswer => ({
  key: `a${k++}`,
  status: "ok",
  mentioned: true,
  text,
  ...o,
});
const ten = (extra: NarrativeAnswer[] = []) => [
  ...Array.from({ length: 10 - extra.length }, () => ans("Example Ramen House is a ramen place.")),
  ...extra,
];

describe("matchNarrative", () => {
  it("counts answers per word with the simple endings s/es/er/est (lead U4)", () => {
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["cozy"], avoid: ["cheap"] },
      answers: ten([
        ans("Example Ramen House is cheap."),
        ans("Example Ramen House is cheaper than most, the cheapest bowl in town."),
        ans("Example Ramen House prices cheaply."), // "cheaply" is not a listed ending
      ]),
    });
    expect(r.avoid).toEqual([{ word: "cheap", answers: 2 }]);
    expect(r.want).toEqual([{ word: "cozy", answers: 0 }]);
    expect(r.clashes).toBe(2);
    expect(r.n).toBe(10);
  });

  it("case-insensitive, whole words only ('art' doesn't match 'party')", () => {
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["art", "cozy"], avoid: [] },
      answers: ten([ans("Example Ramen House throws a PARTY. So COZY.")]),
    });
    expect(r.want).toEqual([
      { word: "art", answers: 0 },
      { word: "cozy", answers: 1 },
    ]);
  });

  it("phrases match with the ending on the last word", () => {
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["family owned"], avoid: [] },
      answers: ten([ans("Example Ramen House: family owned since 1990."), ans("Example Ramen House, Family-owned.")]),
    });
    expect(r.want).toEqual([{ word: "family owned", answers: 1 }]);
  });

  it(`only text within ±${WINDOW} characters of the business name (or an alias) counts`, () => {
    const near = `Example Ramen House ${"x".repeat(WINDOW - "cozy".length - 2)} cozy`;
    const far = `Example Ramen House ${"x".repeat(WINDOW + 1)} cozy`;
    const alias = `${"y ".repeat(200)}Ex Ramen is cozy`;
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["cozy"], avoid: [] },
      answers: ten([ans(near), ans(far), ans(alias)]),
    });
    expect(r.want).toEqual([{ word: "cozy", answers: 2 }]); // near + alias, not far
  });

  it("only counted answers that name the business: unnamed, failed and textless answers are out of n", () => {
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["cozy"], avoid: [] },
      answers: [
        ...ten(),
        ans("Example Ramen House is cozy.", { mentioned: false }),
        ans("Example Ramen House is cozy.", { status: "failed" }),
        ans(null),
      ],
    });
    expect(r.n).toBe(10);
    expect(r.want).toEqual([{ word: "cozy", answers: 0 }]);
  });

  it(`tooFew under ${NARRATIVE_MIN_ANSWERS} answers (the "Too few answers to call yet." state)`, () => {
    const nine = ten().slice(0, 9);
    expect(matchNarrative({ names: NAMES, words: { want: ["cozy"], avoid: [] }, answers: nine }).tooFew).toBe(true);
    expect(matchNarrative({ names: NAMES, words: { want: ["cozy"], avoid: [] }, answers: ten() }).tooFew).toBe(false);
  });

  it("the snippet quotes the first avoid hit (else the first want hit), cut on word boundaries, with offsets", () => {
    const text =
      "People say Example Ramen House is a warm little spot with cozy booths and a cheap lunch set that changes weekly.";
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["cozy"], avoid: ["cheap"] },
      answers: ten([ans(text)]),
    });
    expect(r.snippet).not.toBeNull();
    const s = r.snippet!;
    expect(s.kind).toBe("avoid");
    expect(s.word).toBe("cheap");
    expect(s.text.slice(s.start, s.end)).toBe("cheap");
    expect(s.text.length).toBeLessThanOrEqual(170);
    const wantOnly = matchNarrative({ names: NAMES, words: { want: ["cozy"], avoid: [] }, answers: ten([ans(text)]) });
    expect(wantOnly.snippet).toMatchObject({ kind: "want", word: "cozy" });
  });

  it("a long answer's snippet is trimmed with ellipses at word boundaries", () => {
    const text = `${"lorem ipsum ".repeat(30)}Example Ramen House is cheap ${"dolor sit ".repeat(30)}`;
    const r = matchNarrative({ names: NAMES, words: { want: [], avoid: ["cheap"] }, answers: ten([ans(text)]) });
    const s = r.snippet!;
    expect(s.text.startsWith("…")).toBe(true);
    expect(s.text.endsWith("…")).toBe(true);
    expect(s.text.slice(s.start, s.end)).toBe("cheap");
    // No half words at the cuts: every word shown is a whole word of the answer.
    const words = new Set(text.split(/\s+/));
    for (const w of s.text.replace(/…/g, "").split(/\s+/).filter(Boolean)) expect(words.has(w), w).toBe(true);
  });

  it("a 200-char token right before the hit: offsets stay inside the snippet, cut mid-token with '…'", () => {
    const text = `${"y".repeat(200)}-cheap at Example Ramen House`;
    const r = matchNarrative({ names: NAMES, words: { want: [], avoid: ["cheap"] }, answers: ten([ans(text)]) });
    const s = r.snippet!;
    expect(s.start).toBeGreaterThanOrEqual(0);
    expect(s.end).toBeLessThanOrEqual(s.text.length);
    expect(s.text.slice(s.start, s.end)).toBe("cheap");
    expect(s.text.startsWith("…y")).toBe(true);
    // And after: a long token right after the hit is cut too, never the hit itself.
    const after = `Example Ramen House is cheap-${"z".repeat(200)}`;
    const t = matchNarrative({
      names: NAMES,
      words: { want: [], avoid: ["cheap"] },
      answers: ten([ans(after)]),
    }).snippet!;
    expect(t.text.slice(t.start, t.end)).toBe("cheap");
    expect(t.end).toBeLessThanOrEqual(t.text.length);
    expect(t.text.endsWith("z…")).toBe(true);
  });

  it("no words, or no hits → no snippet; lists keep the user's order", () => {
    expect(matchNarrative({ names: NAMES, words: { want: [], avoid: [] }, answers: ten() })).toMatchObject({
      want: [],
      avoid: [],
      clashes: 0,
      snippet: null,
    });
    const r = matchNarrative({ names: NAMES, words: { want: ["warm", "cozy"], avoid: [] }, answers: ten() });
    expect(r.want.map((w) => w.word)).toEqual(["warm", "cozy"]);
  });

  it("regex characters in a word are matched literally", () => {
    const r = matchNarrative({
      names: NAMES,
      words: { want: ["a+"], avoid: [] },
      answers: ten([ans("Example Ramen House gets an a+ rating"), ans("Example Ramen House aaa")]),
    });
    expect(r.want).toEqual([{ word: "a+", answers: 1 }]);
  });
});
