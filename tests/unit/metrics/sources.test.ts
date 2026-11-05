import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, computeSources, locationKey, sourceLocations, type SourcesQuestion } from "@/lib/metrics";
import type { QuestionWithAnswers } from "@/lib/queries/shell";

// Example data only (example-*.test domains).
type A = SourcesQuestion["answers"][number];
const cite = (domain: string, category: string | null = "other") => ({ url: `https://${domain}/x`, domain, category });
const ans = (
  engine: A["engine"],
  status: A["status"],
  cites: A["citations"] = [],
  supported: A["location_supported"] = "exact",
): A => ({
  engine,
  status,
  location_supported: status === "failed" ? null : supported,
  citations: status === "ok" ? cites : [],
});
const city = (answers: A[]): SourcesQuestion => ({
  location_level: "city",
  country: "US",
  state: "CA",
  city: "Irvine",
  answers,
});
const country = (answers: A[]): SourcesQuestion => ({
  location_level: "country",
  country: "US",
  state: null,
  city: null,
  answers,
});

const QS = [
  city([
    ans(
      "chatgpt",
      "ok",
      [cite("www.example-reviews.test", "review_directory"), cite("example-blog.test", "news_blog")],
      "fallback_country",
    ),
    ans("chatgpt", "failed"),
    ans("google_aio", "ok", [cite("example-reviews.test", "review_directory"), cite("example-forum.test", "reddit")]),
    ans("google_aio", "no_overview"),
    ans("perplexity", "ok", [cite("example-blog.test", "news_blog")]),
  ]),
  country([
    ans("gemini", "ok", [cite("example-video.test", "youtube"), cite("example-blog.test", null)], "exact"),
    ans("chatgpt", "ok", [], "exact"),
  ]),
];
const eng = (s: ReturnType<typeof computeSources>, e: string) => s.engines.find((x) => x.engine === e)!;
const counts = (s: ReturnType<typeof computeSources>, e: string) =>
  Object.fromEntries(eng(s, e).byCategory.map((c) => [c.category, c.count]));

describe("computeSources", () => {
  it("takes getQuestionsWithLatestAnswers' questions as they are (type check)", () => {
    const rows: QuestionWithAnswers[] = [];
    const accepted: SourcesQuestion[] = rows;
    expect(computeSources({ questions: accepted }).topDomains).toEqual([]);
  });

  it("one card per engine in fixed order, every category listed in fixed order", () => {
    const s = computeSources({ questions: QS });
    expect(s.engines.map((e) => e.engine)).toEqual(["chatgpt", "gemini", "google_aio", "perplexity"]);
    for (const e of s.engines) expect(e.byCategory.map((c) => c.category)).toEqual([...CATEGORY_ORDER]);
  });

  it("counts links of ok answers only; failed and no_overview add nothing", () => {
    const s = computeSources({ questions: QS });
    expect(eng(s, "chatgpt").links).toBe(2);
    expect(counts(s, "chatgpt")).toMatchObject({ review_directory: 1, news_blog: 1, other: 0 });
    expect(eng(s, "google_aio").links).toBe(2);
    expect(eng(s, "gemini").links).toBe(2);
    expect(counts(s, "gemini")).toMatchObject({ youtube: 1, other: 1 });
  });

  it("an engine with no links → links 0, all-zero categories (UI: 'No links cited by {Engine}')", () => {
    const s = computeSources({ questions: [city([ans("chatgpt", "ok", [cite("example-a.test")])])] });
    expect(eng(s, "perplexity")).toEqual({
      engine: "perplexity",
      links: 0,
      byCategory: CATEGORY_ORDER.map((category) => ({ category, count: 0 })),
      locationSupport: null,
    });
  });

  it("badge: any fallback → fallback; all exact → exact; nothing ran → null; failed answers don't decide it", () => {
    const s = computeSources({ questions: QS });
    expect(eng(s, "chatgpt").locationSupport).toBe("fallback");
    expect(eng(s, "google_aio").locationSupport).toBe("exact");
    expect(eng(s, "gemini").locationSupport).toBe("exact");
    const onlyFailed = computeSources({ questions: [city([ans("gemini", "failed")])] });
    expect(eng(onlyFailed, "gemini").locationSupport).toBeNull();
  });

  it("location filter narrows chart and table; an unknown key gives nothing", () => {
    const cityKey = locationKey(QS[0]);
    const s = computeSources({ questions: QS, location: cityKey });
    expect(eng(s, "gemini").links).toBe(0);
    expect(eng(s, "chatgpt").locationSupport).toBe("fallback");
    expect(s.topDomains.map((d) => d.domain)).not.toContain("example-video.test");
    const countryOnly = computeSources({ questions: QS, location: locationKey(QS[1]) });
    expect(eng(countryOnly, "chatgpt").locationSupport).toBe("exact");
    const none = computeSources({ questions: QS, location: "city:US|CA|Nowhere" });
    expect(none.engines.every((e) => e.links === 0 && e.locationSupport === null)).toBe(true);
    expect(none.topDomains).toEqual([]);
    expect(none.locations).toHaveLength(2);
  });

  it("top domains: bare domain, links, engines in order, most-cited category, sorted by links then domain", () => {
    const s = computeSources({ questions: QS });
    expect(s.topDomains).toEqual([
      { domain: "example-blog.test", category: "news_blog", links: 3, engines: ["chatgpt", "gemini", "perplexity"] },
      { domain: "example-reviews.test", category: "review_directory", links: 2, engines: ["chatgpt", "google_aio"] },
      { domain: "example-forum.test", category: "reddit", links: 1, engines: ["google_aio"] },
      { domain: "example-video.test", category: "youtube", links: 1, engines: ["gemini"] },
    ]);
  });

  it("a null or unknown category counts as other; category ties go to the fixed order", () => {
    const s = computeSources({
      questions: [
        city([
          ans("chatgpt", "ok", [
            cite("example-a.test", null),
            cite("example-a.test", "nonsense"),
            cite("example-b.test", "social"),
            cite("example-b.test", "reddit"),
          ]),
        ]),
      ],
    });
    expect(counts(s, "chatgpt")).toMatchObject({ other: 2, social: 1, reddit: 1 });
    expect(s.topDomains.find((d) => d.domain === "example-b.test")!.category).toBe("reddit");
    expect(s.topDomains.find((d) => d.domain === "example-a.test")!.category).toBe("other");
  });

  it("top domains cap at 20", () => {
    const many = Array.from({ length: 25 }, (_, i) => cite(`example-${String(i).padStart(2, "0")}.test`));
    expect(computeSources({ questions: [city([ans("perplexity", "ok", many)])] }).topDomains).toHaveLength(20);
  });

  it("no questions or no answers → empty everything", () => {
    const s = computeSources({ questions: [city([])] });
    expect(s.engines.every((e) => e.links === 0)).toBe(true);
    expect(s.topDomains).toEqual([]);
    expect(s.locations).toEqual([]);
  });
});

describe("locations", () => {
  it("distinct targets with answers, labeled like the Questions badge, city → state → country", () => {
    const state: SourcesQuestion = {
      location_level: "state",
      country: "US",
      state: "CA",
      city: "Irvine",
      answers: [ans("perplexity", "ok")],
    };
    expect(
      sourceLocations([
        country([ans("gemini", "ok")]),
        state,
        city([ans("chatgpt", "ok")]),
        city([ans("gemini", "ok")]),
      ]),
    ).toEqual([
      { key: "city:US|CA|Irvine", label: "City", level: "city" },
      { key: "state:US|CA|", label: "State", level: "state" },
      { key: "country:US||", label: "Country", level: "country" },
    ]);
  });

  it("only when two targets share a level is the place added", () => {
    const other = { ...city([ans("gemini", "ok")]), city: "Tustin" };
    expect(sourceLocations([city([ans("chatgpt", "ok")]), other]).map((l) => l.label)).toEqual([
      "City · Irvine, CA",
      "City · Tustin, CA",
    ]);
  });

  it("questions without answers in the run are not offered", () => {
    expect(sourceLocations([city([]), country([ans("gemini", "ok")])]).map((l) => l.level)).toEqual(["country"]);
  });
});
