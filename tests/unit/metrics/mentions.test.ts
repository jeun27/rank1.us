import { describe, expect, it } from "vitest";
import { mentionTargets, r17Fill, type MentionInput } from "@/lib/metrics/mentions";

// Example data only: Example Ramen House vs two Example rivals.
const brands: MentionInput["brands"] = [
  { name: "Example Ramen House", kind: "business", domain: "exampleramen.test" },
  { name: "Example Noodle Bar", kind: "competitor", domain: "examplenoodle.test" },
  { name: "Example Pho Spot", kind: "competitor", domain: null },
];
const mention = (name: string, kind: "business" | "competitor", mentioned: boolean) => ({
  name,
  kind,
  mentioned,
  position: mentioned ? 1 : null,
});
const answer = (
  id: string,
  o: {
    business?: boolean;
    rivals?: string[];
    status?: "ok" | "failed";
    question?: string | null;
    engine?: string;
  } = {},
) => ({
  id,
  engine: (o.engine ?? "gemini") as never,
  status: o.status ?? "ok",
  question_id: o.question === undefined ? "q1" : o.question,
  mentioned: o.business ?? false,
  brands: [
    mention("Example Ramen House", "business", o.business ?? false),
    mention("Example Noodle Bar", "competitor", (o.rivals ?? []).includes("Example Noodle Bar")),
    mention("Example Pho Spot", "competitor", (o.rivals ?? []).includes("Example Pho Spot")),
  ],
});
const cite = (answer_id: string, url: string, category: string | null = "news_blog", title: string | null = null) => ({
  answer_id,
  url,
  domain: new URL(url).hostname.replace(/^www\./, ""),
  title,
  category,
});

const LIST = "https://www.example-eats.test/best-ramen-irvine";
const input = (over: Partial<MentionInput> = {}): MentionInput => ({
  brands,
  answers: [
    answer("a1", { rivals: ["Example Noodle Bar"] }),
    answer("a2", { rivals: ["Example Noodle Bar", "Example Pho Spot"], engine: "perplexity" }),
    answer("a3", { business: true, rivals: ["Example Noodle Bar"] }), // names us: not a gap
    answer("a4", {}), // names no rival
    answer("a5", { rivals: ["Example Pho Spot"] }),
  ],
  citations: [
    cite("a1", `${LIST}?utm_source=x`, "news_blog", "Best ramen in Irvine"),
    cite("a2", `${LIST}/`),
    cite("a2", "https://reddit.test/r/irvine/ramen", "reddit"),
    cite("a3", "https://ourmentions.test/list"), // from an answer that names us
    cite("a4", "https://norivals.test/list"), // from an answer with no rival
    cite("a1", "https://examplenoodle.test/menu", "other"), // a rival's own site
    cite("a5", "https://shop.exampleramen.test/about", "other"), // our own site (subdomain)
    cite("a5", "https://reddit.test/r/irvine/ramen", "reddit"),
  ],
  ...over,
});

describe("mentionTargets", () => {
  it("pages cited in answers that name a rival but not the business, with rivals, k of n and engines", () => {
    const r = mentionTargets(input(), []);
    expect(r.n).toBe(3); // a1, a2, a5
    expect(r.candidates).toEqual([
      {
        url: "https://reddit.test/r/irvine/ramen",
        domain: "reddit.test",
        title: null,
        category: "Reddit",
        rivals: ["Example Pho Spot", "Example Noodle Bar"],
        answers: 2,
        engines: ["gemini", "perplexity"],
      },
      {
        url: "https://www.example-eats.test/best-ramen-irvine",
        domain: "example-eats.test",
        title: "Best ramen in Irvine",
        category: "News and blogs",
        rivals: ["Example Noodle Bar", "Example Pho Spot"],
        answers: 2,
        engines: ["gemini", "perplexity"],
      },
    ]);
  });

  it("excludes the business's own site (incl. subdomains) and rivals' own sites", () => {
    const urls = mentionTargets(input(), []).candidates.map((c) => c.domain);
    expect(urls).not.toContain("examplenoodle.test");
    expect(urls).not.toContain("shop.exampleramen.test");
  });

  it("only counted answers: failed answers and deleted questions don't count", () => {
    const r = mentionTargets(
      input({
        answers: [
          answer("a1", { rivals: ["Example Noodle Bar"], status: "failed" }),
          answer("a2", { rivals: ["Example Noodle Bar"], question: null }),
        ],
      }),
      [],
    );
    expect(r).toEqual({ n: 0, candidates: [], added: [], dismissed: [] });
  });

  it("decisions split the pages: added (for R17), dismissed (hidden), the rest are candidates", () => {
    const r = mentionTargets(input(), [
      { url: "https://www.example-eats.test/best-ramen-irvine", status: "added", decided_at: "2026-11-06T08:00:00Z" },
      { url: "https://reddit.test/r/irvine/ramen", status: "dismissed", decided_at: "2026-11-06T08:00:00Z" },
    ]);
    expect(r.candidates).toEqual([]);
    expect(r.added.map((t) => t.url)).toEqual(["https://www.example-eats.test/best-ramen-irvine"]);
    expect(r.dismissed.map((t) => t.url)).toEqual(["https://reddit.test/r/irvine/ramen"]);
  });

  it("a decision is matched on the normalised URL (utm, trailing slash, host case)", () => {
    const r = mentionTargets(input(), [
      { url: "https://WWW.example-eats.test/best-ramen-irvine/?utm_medium=y", status: "dismissed", decided_at: "x" },
    ]);
    expect(r.dismissed).toHaveLength(1);
  });

  it("stable order: most answers first, then URL", () => {
    expect(mentionTargets(input(), [])).toEqual(mentionTargets(input(), []));
  });
});

describe("r17Fill (the grouped 'Get on these lists' fix)", () => {
  it("n = the added lists; rivals = up to 3 names, most-named first, 'A, B and C'", () => {
    const r = mentionTargets(input(), [
      { url: LIST, status: "added", decided_at: "x" },
      { url: "https://reddit.test/r/irvine/ramen", status: "added", decided_at: "x" },
    ]);
    expect(r17Fill(r.added)).toEqual({ n: "2", rivals: "Example Noodle Bar and Example Pho Spot" });
    expect(r17Fill([])).toBeNull();
  });
});
