import { describe, expect, it } from "vitest";
import { computeMetrics, floorPct, type MetricAnswer, type MetricBrand } from "@/lib/metrics";

// Example data only.
const BRANDS: MetricBrand[] = [
  { name: "Example Ramen House", kind: "business" },
  { name: "Example Noodle Bar", kind: "competitor" },
  { name: "Example Izakaya", kind: "competitor" },
];
let seq = 0;
function ans(p: Partial<MetricAnswer> & { names?: string[] }): MetricAnswer {
  const names = p.names ?? [];
  const status = p.status ?? "ok";
  return {
    id: `a${++seq}`,
    question_id: "q1",
    question_text_used: "best ramen in Irvine",
    engine: "chatgpt",
    run_index: 1,
    location_used: "US",
    location_supported: "fallback_country",
    checked_at: "2026-11-05T12:00:00.000Z",
    first_position: null,
    ...p,
    status,
    mentioned: status === "ok" ? names.includes("Example Ramen House") : null,
    brands: status === "ok" ? BRANDS.map((b) => ({ ...b, mentioned: names.includes(b.name), position: null })) : null,
  };
}
const run = (answers: MetricAnswer[], extra = {}) =>
  computeMetrics({ answers, citations: [], brands: BRANDS, ...extra });

describe("visibility", () => {
  it("counts ok answers only: failed and no_overview leave the denominator", () => {
    const m = run([
      ans({ names: ["Example Ramen House"] }),
      ans({ names: [] }),
      ans({ status: "failed" }),
      ans({ status: "no_overview", engine: "google_aio" }),
    ]);
    expect(m.visibility).toMatchObject({ value: 0.5, numerator: 1, denominator: 2 });
    expect(m.jobs).toEqual({ ok: 3, failed: 1 });
  });

  it("per engine, with null value where an engine has no ok answers", () => {
    const m = run([
      ans({ engine: "chatgpt", names: ["Example Ramen House"] }),
      ans({ engine: "gemini", names: [] }),
      ans({ engine: "google_aio", status: "no_overview" }),
      ans({ engine: "perplexity", status: "failed" }),
    ]);
    expect(m.visibility.byEngine).toEqual({
      chatgpt: { value: 1, numerator: 1, denominator: 1 },
      gemini: { value: 0, numerator: 0, denominator: 1 },
      google_aio: { value: null, numerator: 0, denominator: 0 },
      perplexity: { value: null, numerator: 0, denominator: 0 },
    });
  });

  it("a partial run: only finished ok answers count, all failed → null", () => {
    expect(run([ans({ status: "failed" }), ans({ status: "failed" })]).visibility).toEqual({
      value: null,
      numerator: 0,
      denominator: 0,
      byEngine: expect.any(Object),
    });
  });

  it("paid runs skip answers of deleted questions; free audits count them", () => {
    const answers = [
      ans({ names: ["Example Ramen House"] }),
      ans({ question_id: null, names: [] }),
      ans({ question_id: null, names: [] }),
    ];
    expect(run(answers).visibility).toMatchObject({ numerator: 1, denominator: 1 });
    expect(run(answers, { freeAudit: true }).visibility).toMatchObject({ numerator: 1, denominator: 3 });
  });

  it("floorPct never rounds up", () => {
    expect(floorPct({ value: 2 / 3, numerator: 2, denominator: 3 })).toBe(66);
    expect(floorPct({ value: 55 / 160, numerator: 55, denominator: 160 })).toBe(34);
    expect(floorPct({ value: null, numerator: 0, denominator: 0 })).toBeNull();
  });
});

describe("leaderboard", () => {
  const twelve = (names: string[]) => Array.from({ length: 12 }, () => ans({ names }));

  it("each brand on the same answers, sorted by value, with tooFew under 10 answers", () => {
    const m = run([
      ans({ names: ["Example Noodle Bar", "Example Ramen House"] }),
      ans({ names: ["Example Noodle Bar"] }),
      ans({ names: [] }),
      ans({ status: "failed" }),
    ]);
    expect(m.leaderboard.map((r) => [r.name, r.metric.numerator, r.metric.denominator, r.tooFew])).toEqual([
      ["Example Noodle Bar", 2, 3, true],
      ["Example Ramen House", 1, 3, true],
      ["Example Izakaya", 0, 3, true],
    ]);
    expect(run(twelve([])).leaderboard.every((r) => !r.tooFew)).toBe(true);
  });

  it("ties: business first, then name", () => {
    const m = run([ans({ names: ["Example Izakaya", "Example Ramen House", "Example Noodle Bar"] })]);
    expect(m.leaderboard.map((r) => r.name)).toEqual(["Example Ramen House", "Example Izakaya", "Example Noodle Bar"]);
  });

  it("change = whole points (floored) vs the previous run; null without one", () => {
    const now = [ans({ names: ["Example Ramen House"] }), ans({ names: ["Example Ramen House"] }), ans({ names: [] })];
    const before = [
      ans({ names: ["Example Ramen House"] }),
      ans({ names: [] }),
      ans({ names: [] }),
      ans({ names: [] }),
    ];
    const m = run(now, { previous: { answers: before } });
    const you = m.leaderboard.find((r) => r.kind === "business")!;
    expect(you.change).toBe(66 - 25);
    expect(m.leaderboard.find((r) => r.name === "Example Izakaya")!.change).toBe(0);
    expect(run(now).leaderboard.every((r) => r.change === null)).toBe(true);
    expect(run(now, { previous: { answers: [ans({ status: "failed" })] } }).leaderboard[0].change).toBeNull();
  });
});

describe("share of voice", () => {
  it("business mentions / all tracked-brand mentions in the same answers", () => {
    const m = run([
      ans({ names: ["Example Ramen House", "Example Noodle Bar"] }),
      ans({ names: ["Example Noodle Bar", "Example Izakaya"] }),
      ans({ status: "failed" }),
    ]);
    expect(m.shareOfVoice).toEqual({ value: 1 / 4, numerator: 1, denominator: 4 });
  });

  it("zero mentions anywhere → value null, not 0%", () => {
    expect(run([ans({ names: [] }), ans({ names: [] })]).shareOfVoice).toEqual({
      value: null,
      numerator: 0,
      denominator: 0,
    });
  });
});

describe("sources and freshness", () => {
  it("top sources from ok answers only, by count then domain", () => {
    const a = ans({ names: [] });
    const b = ans({ names: [] });
    const f = ans({ status: "failed" });
    const c = (answer_id: string, domain: string, category: "news_blog" | "review_directory" | null) => ({
      answer_id,
      url: `https://${domain}/x`,
      domain,
      position: 1,
      category,
    });
    const m = computeMetrics({
      answers: [a, b, f],
      brands: BRANDS,
      citations: [
        c(a.id, "example-blog.test", "news_blog"),
        c(b.id, "example-blog.test", "news_blog"),
        c(a.id, "Example-Reviews.test", "review_directory"),
        c(b.id, "example-aaa.test", null),
        c(f.id, "example-zzz.test", null),
      ],
    });
    expect(m.sources).toEqual([
      { domain: "example-blog.test", category: "news_blog", count: 2 },
      { domain: "example-aaa.test", category: "other", count: 1 },
      { domain: "example-reviews.test", category: "review_directory", count: 1 },
    ]);
  });

  it("freshness is the latest checked_at; null with no answers", () => {
    const m = run([
      ans({ checked_at: "2026-11-05T10:00:00.000Z" }),
      ans({ checked_at: "2026-11-05T11:30:00.000Z", status: "failed" }),
    ]);
    expect(m.freshness).toBe("2026-11-05T11:30:00.000Z");
    expect(run([]).freshness).toBeNull();
  });
});
