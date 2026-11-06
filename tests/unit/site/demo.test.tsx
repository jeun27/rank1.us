import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPercent } from "@/components/ui/StatNumber";
import {
  demoBoard,
  demoEngines,
  demoFrame,
  demoLastWeek,
  demoQuestion,
  demoThisWeek,
  demoYou,
} from "@/components/site/demo-data";
import { heroCardText, heroLastWeek, heroThisWeek } from "@/components/site/example-data";
import { Hero } from "@/components/site/Hero";

// v3 PR 3 (lead Q1): one Example data fixture for the hero demo. The card line, the engine bars and the
// leaderboard all derive from it, so they can never disagree.
afterEach(() => {
  vi.doUnmock("@/components/site/demo-data");
  vi.resetModules();
});

describe("demo fixture", () => {
  it("is 40 answers per engine: 16 / 13 / 15 / 11, in the engine order", () => {
    expect(demoEngines.map((e) => [e.engine, e.named.numerator, e.named.denominator])).toEqual([
      ["ChatGPT", 16, 40],
      ["Gemini", 13, 40],
      ["Google AI Overview", 15, 40],
      ["Perplexity", 11, 40],
    ]);
  });

  it("this week is the sum of the engines: 55 of 160 = 34%; the hero card uses it", () => {
    expect([demoThisWeek.numerator, demoThisWeek.denominator]).toEqual([55, 160]);
    expect(formatPercent(demoThisWeek)).toBe("34%");
    expect(heroThisWeek).toBe(demoThisWeek);
    expect(heroLastWeek).toBe(demoLastWeek);
    expect(heroCardText(demoThisWeek, demoLastWeek)).toBe("named in 34% of 160 answers, +6 pts");
  });

  it("the leaderboard: You climbs past exactly one rival, from last week's number to this week's", () => {
    const before = demoBoard(demoLastWeek);
    const after = demoBoard(demoThisWeek);
    const you = (b: typeof after) => b.findIndex((r) => r.you);
    expect(you(after)).toBe(you(before) - 1);
    expect(after[you(after)]).toMatchObject({ brand: demoYou, named: demoThisWeek, rank: you(after) + 1 });
    expect(before[you(before)].named).toBe(demoLastWeek);
    // Same rivals, same numbers; only You moves.
    const rivals = (b: typeof after) => b.filter((r) => !r.you).map((r) => [r.brand, r.named]);
    expect(rivals(after)).toEqual(rivals(before));
    for (const b of [before, after]) {
      expect(b.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
      expect(b.every((r, i) => i === 0 || (b[i - 1].named.value ?? 0) >= (r.named.value ?? 0))).toBe(true);
      expect(b.every((r) => r.named.denominator === demoThisWeek.denominator)).toBe(true);
    }
  });
});

describe("demo timeline (one run: type, fill the bars, count up, climb)", () => {
  it("starts empty and ends on the fixture's final state", () => {
    const start = demoFrame(0);
    expect(start).toMatchObject({ typed: "", bars: 0, climbed: false, done: false });
    expect(start.visibility).toEqual(demoLastWeek);
    const end = demoFrame(Infinity);
    expect(end).toEqual({ typed: demoQuestion, bars: 1, visibility: demoThisWeek, climbed: true, done: true });
  });

  it("moves forward only: typing, then bars, then the count-up, then the climb", () => {
    let prev = demoFrame(0);
    let order: string[] = [];
    for (let t = 0; t <= 6000; t += 50) {
      const f = demoFrame(t);
      expect(f.typed.length).toBeGreaterThanOrEqual(prev.typed.length);
      expect(f.bars).toBeGreaterThanOrEqual(prev.bars);
      expect(f.visibility.numerator).toBeGreaterThanOrEqual(prev.visibility.numerator);
      expect(f.visibility.denominator).toBe(demoThisWeek.denominator);
      if (f.typed === demoQuestion && !order.includes("typed")) order.push("typed");
      if (f.bars === 1 && !order.includes("bars")) order.push("bars");
      if (f.visibility === demoThisWeek && !order.includes("count")) order.push("count");
      if (f.climbed && !order.includes("climb")) order.push("climb");
      prev = f;
    }
    expect(order).toEqual(["typed", "bars", "count", "climb"]);
    expect(prev.done).toBe(true);
    // Mid-run: the question is half typed and no bar has started.
    const mid = demoFrame(400);
    expect(mid.typed.length).toBeGreaterThan(0);
    expect(mid.typed.length).toBeLessThan(demoQuestion.length);
    expect(mid.bars).toBe(0);
    order = [];
  });
});

describe("Hero", () => {
  it("one H1 that reads as one sentence; line 2 is in the accent", () => {
    render(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveAccessibleName("Be the brand AI names first.");
    expect(within(h1).getByText("AI names first.")).toHaveClass("text-accent");
  });

  it("the sub names the 4 engines as tags, inside the exact sentence", () => {
    const { container } = render(<Hero />);
    const sub = container.querySelector("[data-hero-sub]")!;
    expect(sub.textContent).toBe(
      "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next.",
    );
    expect([...sub.querySelectorAll("[data-engine-tag]")].map((t) => t.textContent)).toEqual(
      demoEngines.map((e) => e.engine),
    );
  });

  it("the demo renders the final state from the fixture: question, bars, card line, leaderboard", () => {
    const { container } = render(<Hero />);
    const demo = container.querySelector("[data-demo]") as HTMLElement;
    expect(within(demo).getByText("Example data")).toBeInTheDocument();
    expect(demo.querySelector("[data-demo-question]")?.textContent).toBe(demoQuestion);
    const bars = [...demo.querySelectorAll("[data-demo-bar]")];
    expect(bars.map((b) => b.getAttribute("data-demo-bar"))).toEqual(demoEngines.map((e) => e.engine));
    bars.forEach((b, i) =>
      expect(b.querySelector("[data-computed]")?.textContent).toBe(
        `${demoEngines[i].named.numerator} of ${demoEngines[i].named.denominator}`,
      ),
    );
    expect(demo.querySelector("[data-hero-text]")?.textContent).toBe(heroCardText(demoThisWeek, demoLastWeek));
    const rows = [...demo.querySelectorAll("[data-demo-row]")];
    expect(rows.map((r) => r.getAttribute("data-demo-row"))).toEqual(demoBoard(demoThisWeek).map((r) => r.brand));
    expect(within(rows.find((r) => r.hasAttribute("data-you")) as HTMLElement).getByText("You")).toBeInTheDocument();
  });

  it("has no numbers of its own: a different fixture changes everything the demo shows", async () => {
    vi.resetModules();
    vi.doMock("@/components/site/demo-data", async (orig) => {
      const real = await orig<typeof import("@/components/site/demo-data")>();
      const m = (n: number, d: number) => ({ value: n / d, numerator: n, denominator: d });
      const engines = [
        { engine: "ChatGPT", named: m(9, 20) },
        { engine: "Gemini", named: m(5, 20) },
        { engine: "Google AI Overview", named: m(7, 20) },
        { engine: "Perplexity", named: m(3, 20) },
      ];
      const thisWeek = m(24, 80);
      const lastWeek = m(20, 80);
      const rivals = [
        { brand: "Example A", named: m(40, 80) },
        { brand: "Example B", named: m(22, 80) },
        { brand: "Example C", named: m(10, 80) },
      ];
      const board = (you: ReturnType<typeof m>) =>
        [...rivals.map((r) => ({ ...r, you: false })), { brand: "Example Me", named: you, you: true }]
          .sort((a, b) => b.named.value - a.named.value)
          .map((r, i) => ({ ...r, rank: i + 1 }));
      return {
        ...real,
        demoEngines: engines,
        demoThisWeek: thisWeek,
        demoLastWeek: lastWeek,
        demoYou: "Example Me",
        demoQuestion: "best tacos in Irvine",
        demoBoard: board,
        demoFrame: () => ({ typed: "best tacos in Irvine", bars: 1, visibility: thisWeek, climbed: true, done: true }),
      };
    });
    const { Hero: MockedHero } = await import("@/components/site/Hero");
    const { container } = render(<MockedHero />);
    const demo = container.querySelector("[data-demo]")!;
    expect(demo.querySelector("[data-demo-question]")?.textContent).toBe("best tacos in Irvine");
    expect([...demo.querySelectorAll("[data-demo-bar] [data-computed]")].map((e) => e.textContent)).toEqual([
      "9 of 20",
      "5 of 20",
      "7 of 20",
      "3 of 20",
    ]);
    expect(demo.querySelector("[data-hero-text]")?.textContent).toBe("named in 30% of 80 answers, +5 pts");
    expect([...demo.querySelectorAll("[data-demo-row]")].map((r) => r.getAttribute("data-demo-row"))).toEqual([
      "Example A",
      "Example Me",
      "Example B",
      "Example C",
    ]);
  });
});
