import { describe, expect, it } from "vitest";
import { buildWorkspace } from "@/lib/queries/workspace";
import { buildBrief, claudeUrl, CLAUDE_Q_MAX, contextFor, SECTIONS, type Selection } from "@/lib/workspace/context";
import { exampleWorkspaceRows } from "@/app/team/example-data";

const view = buildWorkspace(exampleWorkspaceRows());
const now = new Date("2026-11-05T12:00:00Z");

const selections: Selection[] = [
  ...SECTIONS.map((section) => ({ kind: "section", section }) as const),
  ...view.questions.map((q) => ({ kind: "question", id: q.id }) as const),
  ...view.competitors.map((c) => ({ kind: "competitor", name: c.name }) as const),
  ...view.sources.domains.map((d) => ({ kind: "domain", domain: d.domain }) as const),
  ...view.checks.map((c) => ({ kind: "check", runId: c.runId }) as const),
];

// Every number a brief may contain: stored counts, their floored percents, check ages and dates, and digits
// that are part of stored text (question wording, domains). Anything else would be an invented number.
function allowedNumbers(): Set<string> {
  const out = new Set<string>();
  const add = (n: number) => out.add(String(n));
  const metric = (m: { numerator: number; denominator: number }) => {
    add(m.numerator);
    add(m.denominator);
    if (m.denominator) add(Math.floor((m.numerator * 100) / m.denominator));
  };
  for (const c of view.checks) {
    metric(c.visibility);
    add(c.total);
    for (const p of c.finishedAt.split(/\D+/)) if (p) out.add(String(Number(p)));
  }
  const ages = view.checks.map((c) => (now.getTime() - Date.parse(c.finishedAt)) / 3_600_000);
  for (const h of ages) [Math.floor(h), Math.floor(h / 24)].forEach(add);
  Object.values(view.latest.byEngine).forEach(metric);
  metric(view.latest.visibility);
  view.questions.forEach((q) => {
    metric(q.visibility);
    Object.values(q.byEngine).forEach(metric);
    q.answers.forEach((a) => add(a.runIndex));
    for (const m of q.text.matchAll(/\d+/g)) out.add(m[0]);
  });
  view.competitors.forEach((c) => metric(c.named));
  view.sources.domains.forEach((d) => add(d.links));
  Object.values(view.sources.byEngine).forEach(add);
  add(view.sources.links);
  add(view.questions.length);
  add(view.competitors.length - 1);
  for (const c of view.checks) {
    const prev = view.checks[view.checks.indexOf(c) + 1];
    if (prev)
      add(
        Math.abs(
          Math.floor((c.visibility.numerator * 100) / c.visibility.denominator) -
            Math.floor((prev.visibility.numerator * 100) / prev.visibility.denominator),
        ),
      );
  }
  return out;
}

describe("buildBrief", () => {
  const allowed = allowedNumbers();

  it.each(selections.map((s) => [JSON.stringify(s), s] as const))("%s uses only stored numbers", (_, s) => {
    const brief = buildBrief(contextFor(view, s), now);
    const stripped = brief.replace(/https?:\/\/\S+/g, "").replace(/\b[\w-]+\.test\b/g, "");
    const numbers = [...stripped.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/,/g, ""));
    expect(numbers.filter((n) => !allowed.has(n))).toEqual([]);
    expect(brief).toContain("API-measured, directional");
    expect(brief).toContain("Example data");
  });

  it("dashboard brief is the exact Markdown of the latest check", () => {
    const brief = buildBrief(contextFor(view, { kind: "section", section: "dashboard" }), now);
    const v = view.latest.visibility;
    const pct = Math.floor((v.numerator * 100) / v.denominator);
    expect(brief.split("\n").slice(0, 4)).toEqual([
      "# Dashboard",
      "",
      "Example Ramen House · Irvine, CA · Example data",
      `Checked ${Math.floor((now.getTime() - Date.parse(view.latest.checkedAt)) / 86_400_000)} d ago · ${view.latest.answers} answers · API-measured, directional`,
    ]);
    expect(brief).toContain(`- Visibility: ${pct}% (named in ${v.numerator} of ${v.denominator} answers)`);
    expect(brief).toContain(
      `- ChatGPT: named in ${view.latest.byEngine.chatgpt.numerator} of ${view.latest.byEngine.chatgpt.denominator} answers`,
    );
  });

  it("question brief lists only stored cited links", () => {
    const q = view.questions.find((x) => x.answers.some((a) => a.citations.length))!;
    const brief = buildBrief(contextFor(view, { kind: "question", id: q.id }), now);
    const urls = [...brief.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
    const stored = new Set(q.answers.flatMap((a) => a.citations.map((c) => c.url)));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(stored).toContain(u);
  });

  it("empty sections say so and carry no numbers", () => {
    for (const section of ["fixes", "experiments", "reports"] as const) {
      const brief = buildBrief(contextFor(view, { kind: "section", section }), now);
      expect(brief).not.toMatch(/named in/);
    }
  });

  it("appends the prompt template under its own heading, verbatim", () => {
    const ctx = contextFor(view, { kind: "section", section: "dashboard" });
    expect(buildBrief(ctx, now, "  Draft 3 fixes.  ")).toMatch(/\n## Prompt template\n\nDraft 3 fixes\.\n$/);
    expect(buildBrief(ctx, now, "   ")).not.toContain("## Prompt template");
  });
});

describe("claudeUrl", () => {
  it("prefills claude.ai/new with ?q=", () => {
    expect(claudeUrl("# Hi & bye")).toBe("https://claude.ai/new?q=%23%20Hi%20%26%20bye");
  });

  it("drops the prefill when the brief is too long; the clipboard still has it", () => {
    expect(claudeUrl("x".repeat(CLAUDE_Q_MAX + 1))).toBe("https://claude.ai/new");
  });
});
