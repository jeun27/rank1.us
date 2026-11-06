import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiAccessPanel, AiReassure } from "@/components/audit/AiAccessPanel";
import { aiAccessCopy as c } from "@/components/audit/ai-access";
import { AI_CRAWLERS, type AiAccessCheck } from "@/lib/queries/ai-access";

// G2 (lead OK 2026-11-06, D1): the answer first, then n of 6, the crawler table with the deciding robots.txt
// line, the JavaScript-off row, the hint, and when it was checked. Unreachable: one line, no table.
const NOW = new Date("2026-11-06T12:00:00Z");
const check = (over: Partial<AiAccessCheck> = {}): AiAccessCheck => ({
  run_id: "r1",
  business_id: null,
  domain: "exampleramen.test",
  checked_at: "2026-11-06T10:00:00Z",
  outcome: "blocked",
  crawlers: AI_CRAWLERS.map((agent) => ({
    agent,
    allowed: agent !== "PerplexityBot" && agent !== "GPTBot",
    line: agent === "PerplexityBot" || agent === "GPTBot" ? "Disallow: /" : agent === "ClaudeBot" ? "Allow: /" : null,
  })),
  visible_words: 420,
  status_normal: 200,
  status_gptbot: 200,
  cloudflare: false,
  pages_checked: 1,
  error: null,
  ...over,
});

describe("AiAccessPanel", () => {
  it("answer, n of 6, the table with each deciding line, JS off, checked when", () => {
    render(<AiAccessPanel check={check()} now={NOW} />);
    const panel = screen.getByRole("region", { name: c.title });
    expect(within(panel).getByText(/^AI search can't read your site: PerplexityBot is blocked/)).toBeInTheDocument();
    expect(within(panel).getByText(c.count(4))).toBeInTheDocument();
    const rows = within(panel).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([...AI_CRAWLERS]);
    const row = (agent: string) => rows.find((r) => r.textContent?.startsWith(agent))!;
    expect(row("PerplexityBot")).toHaveTextContent(c.blocked);
    expect(row("PerplexityBot")).toHaveTextContent("Disallow: /");
    expect(row("ClaudeBot")).toHaveTextContent("Allow: /");
    expect(row("ChatGPT-User")).toHaveTextContent(c.noRule);
    // A search bot's block is the error tone; another crawler's block is info (the owner's call).
    expect(within(row("PerplexityBot")).getByText(c.blocked)).toHaveAttribute("data-tone", "error");
    expect(within(row("GPTBot")).getByText(c.blocked)).toHaveAttribute("data-tone", "info");
    expect(panel).toHaveTextContent(`${c.jsOff}${c.words(420)}`);
    expect(panel).toHaveTextContent(c.checked("2 h"));
    expect(panel).toHaveTextContent(c.explainer);
  });

  it("cloudflare: the R16 title and its hint", () => {
    render(
      <AiAccessPanel
        check={check({
          outcome: "cloudflare",
          cloudflare: true,
          crawlers: check().crawlers.map((x) => ({ ...x, allowed: true })),
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(c.cloudflareTitle)).toBeInTheDocument();
    expect(screen.getByText(c.cloudflareHint)).toBeInTheDocument();
  });

  it("unreachable: one line, no table", () => {
    render(
      <AiAccessPanel
        check={check({ outcome: "unreachable", crawlers: [], visible_words: null, status_normal: null })}
        now={NOW}
      />,
    );
    const panel = screen.getByRole("region", { name: c.title });
    expect(panel).toHaveTextContent("We couldn't reach exampleramen.test.");
    expect(within(panel).queryByRole("table")).toBeNull();
  });
});

describe("AiReassure (the /app dashboard line)", () => {
  it("good: one quiet line with the age", () => {
    render(
      <AiReassure
        check={check({ outcome: "good", crawlers: check().crawlers.map((x) => ({ ...x, allowed: true })) })}
        now={NOW}
      />,
    );
    expect(screen.getByText(c.reassure("2 h"))).toBeInTheDocument();
    expect(c.reassure("2 h")).toBe("AI can read your site · checked 2 h ago");
  });

  it("anything but good renders nothing (the P5 fix carries it)", () => {
    const { container } = render(<AiReassure check={check()} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });
});
