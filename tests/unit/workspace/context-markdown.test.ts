import { describe, expect, it } from "vitest";
import { computeMetrics, computeSources, metric, type MetricAnswer } from "@/lib/metrics";
import { BRIEF_MAX, CLAUDE_URL, buildContextMarkdown, type ContextInput } from "@/lib/workspace/context";

// Example data only. Built through computeMetrics / computeSources, as the team pages do.
const NOW = new Date("2026-11-05T12:00:00.000Z");
const AT = "2026-11-05T10:00:00.000Z";
const BRANDS = [
  { name: "Example Ramen House", kind: "business" as const },
  { name: "Example Noodle Bar", kind: "competitor" as const },
];
let seq = 0;
const ans = (
  engine: MetricAnswer["engine"],
  status: MetricAnswer["status"],
  names: string[],
  qid = "q1",
): MetricAnswer => ({
  id: `a${++seq}`,
  question_id: qid,
  question_text_used: "best ramen in Irvine",
  engine,
  run_index: 1,
  status,
  mentioned: status === "ok" ? names.includes("Example Ramen House") : null,
  first_position: null,
  brands: status === "ok" ? BRANDS.map((b) => ({ ...b, mentioned: names.includes(b.name), position: null })) : null,
  location_used: "US",
  location_supported: engine === "chatgpt" ? "fallback_country" : "exact",
  checked_at: AT,
});
const answers = [
  ans("chatgpt", "ok", ["Example Ramen House", "Example Noodle Bar"]),
  ans("gemini", "ok", ["Example Noodle Bar"]),
  ans("google_aio", "no_overview", []),
  ans("perplexity", "failed", []),
  ans("chatgpt", "ok", [], "q2"),
];
const questions: ContextInput["questions"] = [
  {
    id: "q1",
    text: "best ramen in Irvine",
    answers: [
      {
        engine: "chatgpt",
        status: "ok",
        mentioned: true,
        location_supported: "fallback_country",
        citations: [{ url: "https://example-reviews.test/r", domain: "example-reviews.test", title: "Example review" }],
      },
      { engine: "gemini", status: "ok", mentioned: false, location_supported: "exact", citations: [] },
    ],
  },
  {
    id: "q2",
    text: "ramen near UC Irvine",
    answers: [
      { engine: "chatgpt", status: "ok", mentioned: false, location_supported: "fallback_country", citations: [] },
    ],
  },
  {
    id: "q3",
    text: "late-night ramen near Irvine Spectrum Center",
    answers: [{ engine: "perplexity", status: "failed", mentioned: null, location_supported: null, citations: [] }],
  },
];
const input = (p: Partial<ContextInput> = {}): ContextInput => ({
  business: { name: "Example Ramen House", city: "Irvine", state: "CA" },
  metrics: computeMetrics({ answers, citations: [], brands: BRANDS }),
  sources: computeSources({
    questions: [
      {
        location_level: "city",
        country: "US",
        state: "CA",
        city: "Irvine",
        answers: [
          {
            engine: "chatgpt",
            status: "ok",
            location_supported: "fallback_country",
            citations: [
              { url: "https://example-reviews.test/r", domain: "example-reviews.test", category: "review_directory" },
            ],
          },
        ],
      },
    ],
  }),
  fixes: {
    ranked: [
      {
        title: "Crawlable HTML menu on your own site",
        detail: "Your menu is a PDF; there's no menu page with the dishes as text.",
      },
    ],
    tidyUps: [
      {
        title: "Restaurant/Menu schema (hygiene only)",
        detail:
          "Tidy-up: your site has no Restaurant/Menu structured data. This is housekeeping, not an AI visibility fix.",
      },
    ],
  },
  questions,
  checks: [
    { id: "run-2", status: "complete", started_at: AT, finished_at: AT, visibility: metric(1, 3) },
    {
      id: "run-1",
      status: "partial",
      started_at: "2026-10-29T10:00:00.000Z",
      finished_at: "2026-10-29T10:40:00.000Z",
      visibility: metric(0, 3),
    },
  ],
  ...p,
});
const dash = (p: Partial<ContextInput> = {}) =>
  buildContextMarkdown(input(p), { kind: "section", section: "dashboard" }, NOW);

describe("buildContextMarkdown", () => {
  it("dashboard brief: header with freshness, n and the label, then the stored sections", () => {
    expect(dash()).toBe(
      [
        "# Example Ramen House",
        "",
        "Example Ramen House · Irvine, CA",
        "Checked 2 h ago · 3 answers · API-measured, directional",
        "",
        "## Visibility",
        "",
        "- Visibility: 33% (named in 1 of 3 answers)",
        "- Change: +33 pts",
        "- ChatGPT: 50% (named in 1 of 2 answers)",
        "  ChatGPT can't target a city yet, so we check it for the whole country.",
        "- Gemini: 0% (named in 0 of 1 answers)",
        "- Google AI Overview: no answers yet",
        "- Perplexity: no answers yet",
        "",
        "## Leaderboard",
        "",
        "- Example Noodle Bar: 66% (named in 2 of 3 answers), too few answers",
        "- Example Ramen House (you): 33% (named in 1 of 3 answers), too few answers",
        "",
        "## Top sources",
        "",
        "- example-reviews.test (Review sites): 1 link · ChatGPT",
        "",
        "## Open fixes",
        "",
        "- Crawlable HTML menu on your own site: Your menu is a PDF; there's no menu page with the dishes as text.",
        "- Restaurant/Menu schema (hygiene only): Tidy-up: your site has no Restaurant/Menu structured data. This is housekeeping, not an AI visibility fix.",
        "",
        "## Questions where Example Ramen House wasn't named",
        "",
        "- ramen near UC Irvine (named in 0 of 1 answers)",
        "",
      ].join("\n"),
    );
  });

  it("is stable: the same input and now give the same brief", () => {
    expect(dash()).toBe(dash());
  });

  it("every percentage carries its n; no bare 0% when nothing was answered", () => {
    for (const line of dash()
      .split("\n")
      .filter((l) => /\d+%/.test(l)))
      expect(line).toMatch(/named in \d+ of \d+ answers/);
    const none = buildContextMarkdown(
      input({ metrics: null, sources: null, fixes: null, questions: [], checks: [] }),
      { kind: "section", section: "dashboard" },
      NOW,
    );
    expect(none).toContain("- Visibility: no answers yet");
    expect(none).toContain("API-measured, directional");
    expect(none).not.toMatch(/\d+%/);
  });

  it("never prints forbidden fields, even when the inputs carry them", () => {
    const leaky = input();
    const secret = {
      why_note: "WHY-SECRET",
      raw: { vendor: "RAW-SECRET" },
      cost_usd: 12.34,
      email: "owner@example.test",
      token: "TOKEN-SECRET",
      evidence: { x: "EVIDENCE-SECRET" },
      data_source: "DS-SECRET",
      unverified: ["UNV-SECRET"],
    };
    Object.assign(leaky.business, secret);
    Object.assign(leaky.fixes!.ranked[0], secret);
    Object.assign(leaky.questions[0], secret);
    Object.assign(leaky.questions[0].answers[0], secret);
    const all = ["dashboard", "questions", "competitors", "sources", "fixes", "history"] as const;
    for (const section of all) {
      const md = buildContextMarkdown(leaky, { kind: "section", section }, NOW, "Prompt here");
      expect(md, section).not.toMatch(/SECRET|12\.34|owner@example\.test|why_note|cost/);
    }
  });

  it("only stored texts: fix title + detail, question texts, domains; nothing invented", () => {
    const md = dash();
    expect(md).toContain("Your menu is a PDF; there's no menu page with the dishes as text.");
    expect(md).not.toContain("best ramen in Irvine (named in 0"); // named once, so it isn't listed
    expect(md).not.toContain("late-night ramen"); // only failed answers: not counted as not named
  });

  it("caps lists with '…and N more' and the whole brief at 12,000 chars, keeping the header and visibility", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `x${i}`,
      text: `Example question ${i} ${"y".repeat(300)}`,
      answers: [
        {
          engine: "gemini" as const,
          status: "ok" as const,
          mentioned: false,
          location_supported: "exact" as const,
          citations: [],
        },
      ],
    }));
    const fixes = {
      ranked: Array.from({ length: 30 }, (_, i) => ({ title: `Fix ${i}`, detail: "z".repeat(400) })),
      tidyUps: [],
    };
    const md = buildContextMarkdown(input({ questions: many, fixes }), { kind: "section", section: "dashboard" }, NOW);
    expect(md.length).toBeLessThanOrEqual(BRIEF_MAX);
    expect(md).toContain("## Visibility");
    expect(md).toContain("Checked 2 h ago · 3 answers · API-measured, directional");
    const q = buildContextMarkdown(input({ questions: many }), { kind: "section", section: "questions" }, NOW);
    expect(q).toContain("- …and 35 more");
    const f = buildContextMarkdown(input({ fixes }), { kind: "section", section: "fixes" }, NOW);
    expect(f).toContain("- …and 20 more");
  });

  it("selections narrow the brief", () => {
    const q = buildContextMarkdown(input(), { kind: "question", id: "q1" }, NOW);
    expect(q.split("\n")[0]).toBe("# best ramen in Irvine");
    expect(q).toContain("- Visibility: 50% (named in 1 of 2 answers)");
    expect(q).toContain("## Sources");
    expect(q).toContain("- Example review: https://example-reviews.test/r");
    const c = buildContextMarkdown(input(), { kind: "competitor", name: "Example Noodle Bar" }, NOW);
    expect(c).toContain("- Example Noodle Bar: 66% (named in 2 of 3 answers)");
    expect(c).toContain("- Example Ramen House (you): 33%");
    const d = buildContextMarkdown(input(), { kind: "domain", domain: "example-reviews.test" }, NOW);
    expect(d).toContain("- example-reviews.test (Review sites): 1 link · ChatGPT");
    const h = buildContextMarkdown(input(), { kind: "check", runId: "run-1" }, NOW);
    expect(h.split("\n").slice(0, 4)).toEqual([
      "# Oct 29, 2026",
      "",
      "Example Ramen House · Irvine, CA",
      "Checked 7 d ago · 3 answers · API-measured, directional",
    ]);
    expect(h).toContain("- Visibility: 0% (named in 0 of 3 answers)");
  });

  it("adds the prompt template last", () => {
    expect(
      buildContextMarkdown(input(), { kind: "section", section: "dashboard" }, NOW, " Summarize. ").endsWith(
        "## Prompt template\n\nSummarize.\n",
      ),
    ).toBe(true);
  });

  it("Open in Claude carries no brief", () => {
    expect(CLAUDE_URL).toBe("https://claude.ai");
    expect(dash()).not.toContain(CLAUDE_URL);
  });
});
