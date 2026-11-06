import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourcesView } from "@/components/app/SourcesView";
import { sourcesCopy } from "@/components/app/sources-copy";
import { exampleQuestions } from "@/components/app/example-data";
import { computeSources } from "@/lib/metrics";

const sources = computeSources({ questions: exampleQuestions.questions });

describe("Sources (UI.md 4b)", () => {
  it("no run yet: the 4b empty copy", () => {
    render(<SourcesView sources={null} location={undefined} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sources");
    expect(screen.getByText("See which sites each AI cites for your questions.")).toBeInTheDocument();
    expect(screen.getByText("No cited links yet. They show after your first run.")).toBeInTheDocument();
  });

  it("success: one card per engine with {n} links, the location badge, one legend, and no percentages", () => {
    const { container } = render(<SourcesView sources={sources} location={undefined} />);
    const cards = screen.getAllByRole("region", { name: /ChatGPT|Gemini|Google AI Overview|Perplexity/ });
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([
      "ChatGPT",
      "Gemini",
      "Google AI Overview",
      "Perplexity",
    ]);
    for (const [i, e] of sources.engines.entries())
      expect(
        within(cards[i]).getByText(e.links ? `${e.links} ${e.links === 1 ? "link" : "links"}` : /No links cited by/),
      ).toBeInTheDocument();
    expect(within(cards[0]).getByText("Country fallback")).toHaveAttribute(
      "title",
      "ChatGPT can't target a city yet, so we check it for the whole country.",
    );
    expect(within(cards[2]).getByText("Exact")).toBeInTheDocument();
    const legend = screen.getByRole("list", { name: "Category" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Reddit", "YouTube", "Social", "Review sites", "News and blogs", "Other"]);
    expect(container.textContent).not.toMatch(/\d%/);
  });

  it("an engine with no links says so instead of a bar", () => {
    const zero = {
      ...sources,
      engines: sources.engines.map((e) =>
        e.engine === "perplexity" ? { ...e, links: 0, byCategory: e.byCategory.map((c) => ({ ...c, count: 0 })) } : e,
      ),
    };
    render(<SourcesView sources={zero} location={undefined} />);
    expect(screen.getByText("No links cited by Perplexity")).toBeInTheDocument();
  });

  it("top domains: domain link (no referrer), category label, links, engines", () => {
    render(<SourcesView sources={sources} location={undefined} />);
    const table = screen.getByRole("table", { name: "Sources" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Domain", "Category", "Links", "Engines"]);
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByRole("link", { name: "example-reviews.test" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(within(row).getByText("Review sites")).toBeInTheDocument();
  });

  it("the location selector lists All locations + each target, and keeps the choice", () => {
    render(<SourcesView sources={sources} location={sources.locations[0].key} />);
    const select = screen.getByLabelText("Location");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["All locations", ...sources.locations.map((l) => l.label)]);
    expect(select).toHaveValue(sources.locations[0].key);
  });

  it("rule 3: the freshness line with n and 'API-measured, directional' under the H1", () => {
    render(
      <SourcesView
        sources={sources}
        location={undefined}
        checkedAt="2026-11-02T14:40:00Z"
        answers={38}
        now={new Date("2026-11-05T14:40:00Z")}
      />,
    );
    expect(screen.getByText("Checked 3 d ago · 38 answers · API-measured, directional")).toBeInTheDocument();
  });

  it("the location selector is a plain GET form, so it works without JavaScript (QA #49)", () => {
    render(<SourcesView sources={sources} location={undefined} />);
    const select = screen.getByLabelText("Location");
    const form = select.closest("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/app/sources");
    expect(select).toHaveAttribute("name", "location");
    expect(within(form).getByRole("button", { name: "Show" })).toHaveAttribute("type", "submit");
  });

  it("uses only strings that are in docs/COPY.md", () => {
    const md = readFileSync("docs/COPY.md", "utf8");
    const strings = Object.values(sourcesCopy).flatMap((v) =>
      typeof v === "function" ? [v("{Engine}")] : typeof v === "object" ? Object.values(v) : [v],
    );
    for (const s of strings) expect(md, s).toContain(s);
  });
});

// X11 (UX plan PR 22): what to act on first. The top domains table (where to get listed) comes before the
// per-engine bars, and the location filter sits in the freshness row instead of a block of its own.
describe("Sources order (X11)", () => {
  it("freshness + location filter, then top domains, then the engine cards", () => {
    render(
      <SourcesView
        sources={sources}
        location={undefined}
        checkedAt="2026-11-02T14:40:00Z"
        answers={38}
        now={new Date("2026-11-05T14:40:00Z")}
      />,
    );
    const table = screen.getByRole("table", { name: "Sources" });
    const firstEngine = screen.getByRole("region", { name: "ChatGPT" });
    expect(table.compareDocumentPosition(firstEngine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const select = screen.getByRole("combobox");
    const fresh = screen.getByText(/API-measured, directional/);
    const row = select.closest("[data-sources-toolbar]")!;
    expect(row).toContainElement(fresh);
    expect(select.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
