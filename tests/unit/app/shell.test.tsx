import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const path = { current: "/app" };
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

import { AppNav } from "@/components/app/AppNav";
import { appCopy } from "@/components/app/copy";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { Dashboard } from "@/components/app/Dashboard";
import { HistoryView } from "@/components/app/HistoryView";
import { QuestionsView } from "@/components/app/QuestionsView";
import { seriesFromSummaries } from "@/lib/metrics";
import {
  exampleBusiness,
  exampleFailedRun,
  exampleFixes,
  exampleLatest,
  examplePartial,
  exampleQuestions,
  exampleRuns,
  exampleSuggestions,
  exampleTracked,
} from "@/components/app/example-data";

const now = new Date("2026-11-05T12:00:00Z");
const series = seriesFromSummaries(exampleRuns);

describe("AppNav (lead: only pages that exist; Step 9 adds Sources after Questions)", () => {
  it("lists Dashboard, Competitors, Questions, History, Billing and marks the current one", () => {
    path.current = "/app/competitors";
    render(<AppNav />);
    // X2: the md+ rail column; phones use the bottom bar (bottom-nav.spec).
    const nav = screen.getByRole("navigation", { name: "App" }).querySelector<HTMLElement>("[data-rail]")!;
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["Dashboard", "/app"],
      ["Competitors", "/app/competitors"],
      ["Questions", "/app/questions"],
      ["Sources", "/app/sources"],
      ["What to fix next", "/app/fixes"],
      ["Experiments", "/app/experiments"],
      ["Reports", "/app/report"],
      ["History", "/app/history"],
      ["Billing", "/app/billing"],
    ]);
    expect(within(nav).getByRole("link", { name: "Competitors" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  // v3: the rail (logo + Account) stays during onboarding, so the user can still sign out; only the
  // page links are hidden.
  it("hides the page links during onboarding", () => {
    path.current = "/app/onboarding";
    render(<AppNav />);
    expect(within(screen.getByRole("navigation", { name: "App" })).queryAllByRole("link")).toEqual([]);
  });
});

describe("Dashboard (UI.md 4b)", () => {
  it("no business: the 4b empty state with 'Add my business' to onboarding", () => {
    render(<Dashboard business={null} latest={null} series={series} fixes={[]} now={now} />);
    expect(screen.getByText("Nothing tracked yet. Add your domain and I'll find the questions.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add my business" })).toHaveAttribute("href", "/app/onboarding");
  });

  it("no run yet: paid → the first-check note; unpaid → Start for $99/mo to billing", () => {
    const { unmount } = render(
      <Dashboard business={exampleBusiness} latest={null} series={series} fixes={[]} now={now} />,
    );
    // X25: none queued yet (the default) → it runs Monday, with the one next step.
    expect(screen.getByText("Your first check runs Monday.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review your questions" })).toHaveAttribute("href", "/app/questions");
    unmount();
    render(
      <Dashboard business={{ ...exampleBusiness, paid: false }} latest={null} series={series} fixes={[]} now={now} />,
    );
    expect(screen.getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute("href", "/app/billing");
  });

  it("success: hero + n + freshness, per engine, leaderboard top 5 without SoV, the next fix, the 8-run line", () => {
    render(
      <Dashboard business={exampleBusiness} latest={exampleLatest} series={series} fixes={exampleFixes} now={now} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
    // The hero, and the same latest point in the line's table; the You row in the leaderboard has it too.
    const board = screen.getByRole("table", { name: "Competitors" });
    const named = screen.getAllByText("named in 80 of 240 answers");
    expect(named.filter((e) => !board.contains(e))).toHaveLength(2);
    expect(within(board).getAllByText("named in 80 of 240 answers")).toHaveLength(1);
    expect(screen.getByText(/API-measured, directional/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Competitors" })).toBeInTheDocument();
    expect(screen.queryByText("Share of voice")).not.toBeInTheDocument();
    // X1: one next-fix card (the first open fix) replaced the list of 3 titles.
    expect(screen.getByRole("heading", { name: "What to fix next" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "What to fix next" })).toHaveAttribute("href", "/app/fixes#fix-f1");
    expect(screen.getByText(exampleFixes[0].title)).toBeInTheDocument();
    expect(screen.queryByText(exampleFixes[1].title)).not.toBeInTheDocument();
    const line = screen.getByRole("table", { name: "Visibility" });
    expect(within(line).getAllByRole("row")).toHaveLength(9);
    expect(within(line).getByText("named in 44 of 240 answers")).toBeInTheDocument();
  });

  it("partial run: the warn badge; no fixes: no next-fix card or empty line (X1); under 2 runs: no line", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={examplePartial}
        series={seriesFromSummaries(exampleRuns.slice(0, 1))}
        fixes={[]}
        now={now}
      />,
    );
    // DQ18: one "answers" count per screen. The fixture has 5 failed and 5 no_overview answers, so jobs_ok
    // (245, which counts no_overview) differs from the % denominator (240); the badge shows the 240.
    const { run, answers } = examplePartial.results;
    expect(answers.filter((a) => a.status === "no_overview")).toHaveLength(5);
    expect(run.jobs_ok).toBe(245);
    expect(examplePartial.metrics.visibility.denominator).toBe(240);
    expect(screen.getByText("Last run partial: 240 of 250 answers")).toBeInTheDocument();
    expect(screen.queryByText(/245/)).not.toBeInTheDocument();
    // X1 (S3): nothing to do renders nothing here; the Fix list's own empty state covers it.
    expect(screen.queryByText("Nothing to fix yet. Run your first check.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "What to fix next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Visibility" })).not.toBeInTheDocument();
  });
});

describe("Competitors (UI.md 4b, SoV only here)", () => {
  const actions = { add: vi.fn(async () => undefined), dismiss: vi.fn(async () => undefined) };

  it("leaderboard with You, share of voice + n, suggested rows with Add / Not a competitor", async () => {
    render(
      <CompetitorsView
        latest={exampleLatest}
        tracked={exampleTracked}
        suggestions={exampleSuggestions}
        actions={actions}
        now={now}
      />,
    );
    expect(screen.getAllByText("You").length).toBeGreaterThan(0);
    expect(screen.getByText("Share of voice")).toBeInTheDocument();
    expect(screen.getByText("25% (80 of 320)")).toBeInTheDocument();
    expect(screen.getAllByText("too few answers").length).toBeGreaterThan(0);
    const suggested = screen.getByRole("region", { name: "Suggested competitors" });
    await userEvent.click(within(suggested).getAllByRole("button", { name: "Add" })[0]);
    expect(actions.add).toHaveBeenCalledWith({
      name: "Example Tonkotsu Co.",
      domain: "exampletonkotsu.test",
      maps_cid: "s1",
      rating: 4.3,
    });
    await userEvent.click(within(suggested).getAllByRole("button", { name: "Not a competitor" }).at(-1)!);
    expect(actions.dismiss).toHaveBeenCalledWith({
      name: "Example Pho Spot",
      domain: "examplepho.test",
      maps_cid: "s2",
      rating: 4.1,
    });
  });

  // X8: phones use the same leaderboard table (stacked), so the separate phone card list is gone.
  it("rule 3: every number shows n, plus freshness and 'API-measured, directional' (one table at every width)", () => {
    render(
      <CompetitorsView latest={exampleLatest} tracked={exampleTracked} suggestions={[]} actions={actions} now={now} />,
    );
    expect(screen.queryByRole("list", { name: "Competitors" })).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Competitors" });
    // DQ4: the % and its n are two parts (mono % over a caption line), so the n never splits the %.
    for (const [pct, n] of [
      ["33%", "named in 80 of 240 answers"],
      ["100%", "named in 240 of 240 answers"],
    ]) {
      expect(within(table).getByText(pct).className).toMatch(/font-mono/);
      expect(within(table).getByText(n).className).toMatch(/text-caption/);
    }
    expect(
      screen.getByText(/^Checked \d+ (min|h|d) ago · 240 answers · API-measured, directional$/),
    ).toBeInTheDocument();
  });

  it("no competitors: the 4b empty copy and the manual add form", async () => {
    render(<CompetitorsView latest={null} tracked={[]} suggestions={[]} actions={actions} now={now} />);
    expect(screen.getByText("No competitors yet. Add 3-5 local places to compare.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Example Soba Stand");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(actions.add).toHaveBeenCalledWith({ name: "Example Soba Stand", domain: null });
  });
});

describe("Questions (UI.md 4b)", () => {
  it("rows with per-engine counts, location badge, a failed '–' with the lead tooltip, and a drawer", async () => {
    render(<QuestionsView data={exampleQuestions} />);
    const first = screen.getByRole("button", { name: /best ramen in Irvine/ });
    expect(screen.getAllByText("City").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("This check failed. It doesn't count toward your numbers.").length).toBeGreaterThan(0);
    await userEvent.click(first);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText(/Example data\. Picks for "best ramen in Irvine"/).length).toBeGreaterThan(0);
    for (const a of within(dialog).getAllByRole("link")) expect(a).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  });

  it("no questions: 'No questions yet.' and 'Use the restaurant template' to onboarding", () => {
    render(<QuestionsView data={{ run: null, questions: [] }} />);
    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Use the restaurant template" })).toHaveAttribute(
      "href",
      "/app/onboarding",
    );
  });
});

describe("History (UI.md 4b)", () => {
  it("one row per run, newest first: date, visibility + n, change, status; opens the run; CSV per run", () => {
    render(<HistoryView runs={[exampleFailedRun, ...exampleRuns]} />);
    const rows = within(screen.getByRole("table", { name: "History" }))
      .getAllByRole("row")
      .slice(1);
    expect(rows).toHaveLength(9);
    expect(within(rows[0]).getByText("Failed")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Complete")).toBeInTheDocument();
    // DQ18: the partial run received 245 answers, 5 of them no_overview, so its n is 240. The badge uses the n.
    expect(exampleRuns[1].jobs_ok).toBe(245);
    expect(within(rows[2]).getByText("240 of 250 answers")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: /Nov 2, 2026/ })).toHaveAttribute(
      "href",
      "/app/runs/example-run-1",
    );
    expect(within(rows[1]).getByRole("link", { name: "Download CSV" })).toHaveAttribute(
      "href",
      "/app/runs/example-run-1/export.csv",
    );
    // 80 of 240 = 33% vs 72 of 240 = 30%.
    expect(within(rows[1]).getByText("+3 pts")).toBeInTheDocument();
  });

  it("rule 3: the page carries 'API-measured, directional' once", () => {
    render(<HistoryView runs={exampleRuns} />);
    expect(screen.getAllByText("API-measured, directional")).toHaveLength(1);
  });

  it("no runs: the 4b empty copy", () => {
    render(<HistoryView runs={[]} />);
    expect(screen.getByText("No weekly checks yet. Your first one runs Monday.")).toBeInTheDocument();
  });
});

describe("app shell copy", () => {
  it("uses only strings that are in docs/COPY.md", () => {
    const md = readFileSync("docs/COPY.md", "utf8");
    const strings = Object.values(appCopy).map((v) => (typeof v === "function" ? v(230, 250) : v));
    for (const s of strings) expect(md, s).toContain(s.replace("230 of 250", "230 of 250"));
  });
});
