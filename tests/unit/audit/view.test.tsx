import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditView } from "@/components/audit/AuditView";
import { exampleMetrics, exampleRun } from "@/components/audit/example-data";

const now = new Date("2026-11-05T14:30:00Z");
const view = (
  status: Parameters<typeof exampleRun>[0],
  o: Parameters<typeof exampleRun>[1] & { free?: boolean } = {},
) =>
  render(
    <AuditView
      results={exampleRun(status, o)}
      metrics={exampleMetrics}
      free={Boolean(o.free)}
      exportBase={o.free ? "/audit/tok" : "/app/runs/example-run"}
      now={now}
    />,
  );

describe("AuditView: Audit progress (UI.md 4b)", () => {
  it("running: Jelly loading with n of d answers, finished engines shown, the others still checking", () => {
    view("running", { done: { chatgpt: 75, gemini: 30, google_aio: 0, perplexity: 25 } });
    expect(screen.getByText("Checking 4 AI engines…")).toBeInTheDocument();
    expect(screen.getAllByText("130 of 250 answers").length).toBeGreaterThan(0);
    expect(screen.getByText("named in 25 of 72 answers")).toBeInTheDocument();
    expect(screen.getAllByText("still checking")).toHaveLength(2);
    expect(screen.getByText("30 of 75 answers")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download CSV" })).not.toBeInTheDocument();
  });

  it("an engine with failed answers shows the retry message", () => {
    view("running", { done: { gemini: 30 }, failed: { gemini: 4 } });
    expect(
      screen.getByText("Gemini isn't answering right now. We'll retry; your other results are saved."),
    ).toBeInTheDocument();
  });
});

describe("AuditView: Audit results (UI.md 4b)", () => {
  it("complete (paid): H1, hero % with n and freshness, per-engine, leaderboard, sources, downloads, no credit", () => {
    view("complete");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Audit results");
    const board = screen.getByRole("table", { name: "Competitors" });
    // The hero outside the leaderboard (the You row repeats the same % and n inside it).
    const outside = (t: string) => screen.getAllByText(t).filter((e) => !board.contains(e));
    expect(outside("33%")).toHaveLength(1);
    expect(outside("named in 80 of 240 answers")).toHaveLength(1);
    expect(screen.getByText(/Checked 2 h ago · 240 answers · API-measured, directional/)).toBeInTheDocument();
    expect(within(board).getByText("You")).toBeInTheDocument();
    expect(within(board).getByText("too few answers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download CSV" })).toHaveAttribute(
      "href",
      "/app/runs/example-run/export.csv",
    );
    expect(screen.getByRole("link", { name: "Download PNG" })).toHaveAttribute(
      "href",
      "/app/runs/example-run/export.png",
    );
    expect(screen.queryByText("Powered by Rank1")).not.toBeInTheDocument();
    expect(screen.queryByText("Start for $99/mo")).not.toBeInTheDocument();
  });

  it("cited sources open without a referrer, so an audit token in the URL never leaks", () => {
    view("complete", { kind: "free_audit", free: true });
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("https://"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("free: 'Your free audit', the paywall card to billing, and the Powered by Rank1 credit", () => {
    view("complete", { kind: "free_audit", free: true });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your free audit");
    expect(screen.getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute(
      "href",
      "/signin?next=%2Fapp%2Fbilling",
    );
    expect(screen.getByText("Powered by Rank1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download CSV" })).toHaveAttribute("href", "/audit/tok/export.csv");
  });

  it("partial: an engine with no answers is greyed with 'No answers from {Engine} yet'", () => {
    view("partial", { done: { chatgpt: 75, gemini: 75, google_aio: 75, perplexity: 0 } });
    expect(screen.getByText("No answers from Perplexity yet")).toBeInTheDocument();
  });

  it("failed: the run-failed banner and no downloads", () => {
    view("failed", { done: {} });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't finish this audit. Try again later.");
    expect(screen.queryByRole("link", { name: "Download CSV" })).not.toBeInTheDocument();
  });
});

// G2 (lead OK 2026-11-06, U6): "Can AI see your site?" sits below the leaderboard, only with a stored check.
describe("AuditView: the AI access panel", () => {
  const aiAccess = {
    run_id: "r1",
    business_id: null,
    domain: "exampleramen.test",
    checked_at: "2026-11-05T12:30:00Z",
    outcome: "good" as const,
    crawlers: [],
    visible_words: 420,
    status_normal: 200,
    status_gptbot: 200,
    cloudflare: false,
    pages_checked: 1,
    error: null,
  };
  const free = (check: typeof aiAccess | null) =>
    render(
      <AuditView
        results={exampleRun("complete", { kind: "free_audit" })}
        metrics={exampleMetrics}
        free
        exportBase="/audit/tok"
        now={now}
        aiAccess={check}
      />,
    );

  it("below the leaderboard", () => {
    free(aiAccess);
    const panel = screen.getByRole("region", { name: "Can AI see your site?" });
    const leaderboard = screen.getByRole("heading", { name: "Competitors" });
    expect(leaderboard.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no stored check: no panel", () => {
    free(null);
    expect(screen.queryByRole("region", { name: "Can AI see your site?" })).toBeNull();
  });
});
