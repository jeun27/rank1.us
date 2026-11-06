import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NarrativeDashboard } from "@/components/narrative/NarrativeDashboard";
import { narrativeCopy as c } from "@/components/narrative/copy";
import type { NarrativeView } from "@/lib/narrative/service";

// G4 (lead Q2, "show the next step only when it's relevant"): the Dashboard shows the full card for a
// clash, one quiet line when there are no words, and nothing for no clash or too few answers.
const view = (
  over: Partial<NarrativeView["result"] & object> = {},
  words = { want: ["fresh"], avoid: ["cheap", "greasy"] },
): NarrativeView => ({
  words,
  checkedAt: "2026-11-05T12:30:00Z",
  result: {
    n: 48,
    tooFew: false,
    want: [{ word: "fresh", answers: 20 }],
    avoid: [
      { word: "cheap", answers: 6 },
      { word: "greasy", answers: 0 },
    ],
    clashes: 6,
    snippet: { text: "…a cheap spot near the park, with fast…", start: 3, end: 8, word: "cheap", kind: "avoid" },
    ...over,
  },
});

describe("NarrativeDashboard", () => {
  it("a clash: the card with n of d, the words, the quoted snippet with the word marked, Word match, Edit words", () => {
    render(<NarrativeDashboard view={view()} />);
    const card = screen.getByRole("region", { name: c.title });
    expect(card).toHaveTextContent("6 of 48 answers use words you want to avoid: cheap");
    expect(card.querySelector("blockquote")).toHaveTextContent("…a cheap spot near the park, with fast…");
    expect(card.querySelector("mark")).toHaveTextContent("cheap");
    expect(card).toHaveTextContent(c.wordMatch);
    expect(within(card).getByRole("link", { name: c.edit })).toHaveAttribute("href", "/app/settings/narrative");
  });

  it("no words: one quiet line with Add your words, no card", () => {
    render(<NarrativeDashboard view={{ words: { want: [], avoid: [] }, checkedAt: null, result: null }} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText(c.noWords)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.addWords })).toHaveAttribute("href", "/app/settings/narrative");
  });

  it.each([
    ["no clash", view({ clashes: 0, avoid: [{ word: "cheap", answers: 0 }], snippet: null })],
    ["too few answers", view({ n: 7, tooFew: true })],
    ["words but no run yet", { words: { want: ["fresh"], avoid: [] }, checkedAt: null, result: null }],
  ] as const)("%s: nothing on the Dashboard", (_, v) => {
    const { container } = render(<NarrativeDashboard view={v as NarrativeView} />);
    expect(container).toBeEmptyDOMElement();
  });
});
