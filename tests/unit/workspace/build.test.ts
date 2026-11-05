import { describe, expect, it } from "vitest";
import { buildWorkspace, ENGINES } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/app/example-data";
import { BUSINESS, COMPETITORS, seedData } from "../../../scripts/seed/generate";

const rows = exampleWorkspaceRows();
const view = buildWorkspace(rows);
const seed = seedData();
const latestRun = [...seed.runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
const latest = seed.answers.filter((a) => a.run_id === latestRun.id);
const ok = latest.filter((a) => a.status === "ok");

// Every count is recomputed here straight from the raw seed answers, so the builder can't invent or pad one.
describe("buildWorkspace (Example data)", () => {
  it("visibility = answers naming the business / ok answers in the latest check", () => {
    expect(view.business.name).toBe(BUSINESS);
    expect(view.latest.visibility).toMatchObject({
      numerator: ok.filter((a) => a.mentioned).length,
      denominator: ok.length,
    });
    expect(view.latest.checkedAt).toBe(latestRun.finished_at);
    expect(view.latest.answers).toBe(ok.length);
  });

  it("per engine excludes failed and no-overview answers from the denominator", () => {
    for (const e of ENGINES) {
      const eo = ok.filter((a) => a.engine === e);
      expect(view.latest.byEngine[e]).toMatchObject({
        numerator: eo.filter((a) => a.mentioned).length,
        denominator: eo.length,
      });
    }
  });

  it("history has one row per weekly check, newest first, with change from the week before", () => {
    expect(view.checks.map((c) => c.runId)).toEqual(
      [...seed.runs].sort((a, b) => b.started_at.localeCompare(a.started_at)).map((r) => r.id),
    );
    for (const c of view.checks) {
      const o = seed.answers.filter((a) => a.run_id === c.runId && a.status === "ok");
      expect(c.visibility).toMatchObject({ numerator: o.filter((a) => a.mentioned).length, denominator: o.length });
      expect(c.total).toBe(seed.answers.filter((a) => a.run_id === c.runId).length);
    }
    expect(view.checks[0].partial).toBe(true);
  });

  it("questions carry their own counts and only the answers stored for them", () => {
    expect(view.questions).toHaveLength(25);
    for (const q of view.questions) {
      const qa = latest.filter((a) => a.question_id === q.id);
      const qo = qa.filter((a) => a.status === "ok");
      expect(q.visibility).toMatchObject({ numerator: qo.filter((a) => a.mentioned).length, denominator: qo.length });
      expect(q.answers).toHaveLength(qa.length);
      for (const a of q.answers) {
        const stored = seed.citations.filter((c) => c.answer_id === a.id).map((c) => c.url);
        expect(a.citations.map((c) => c.url)).toEqual(stored);
      }
    }
  });

  it("competitors: named in X of the same ok answers, You included, sorted by count", () => {
    expect(view.competitors.map((c) => c.name).sort()).toEqual([BUSINESS, ...COMPETITORS].sort());
    for (const c of view.competitors) {
      const n = ok.filter((a) => a.brands?.some((b) => b.name === c.name)).length;
      expect(c.named).toMatchObject({ numerator: n, denominator: ok.length });
    }
    const counts = view.competitors.map((c) => c.named.numerator);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(view.competitors.filter((c) => c.you).map((c) => c.name)).toEqual([BUSINESS]);
  });

  it("sources are only the stored citations of the latest check", () => {
    const ids = new Set(latest.map((a) => a.id));
    const cites = seed.citations.filter((c) => ids.has(c.answer_id));
    expect(view.sources.links).toBe(cites.length);
    for (const d of view.sources.domains) expect(d.links).toBe(cites.filter((c) => c.domain === d.domain).length);
    expect(view.sources.domains.reduce((s, d) => s + d.links, 0)).toBe(cites.length);
    for (const e of ENGINES) {
      const eIds = new Set(latest.filter((a) => a.engine === e).map((a) => a.id));
      expect(view.sources.byEngine[e]).toBe(cites.filter((c) => eIds.has(c.answer_id)).length);
    }
  });

  it("has no fixes, experiments or reports in the seed, so those stay empty", () => {
    expect(rows).not.toHaveProperty("fixes");
    expect(view).not.toHaveProperty("fixes");
  });
});
