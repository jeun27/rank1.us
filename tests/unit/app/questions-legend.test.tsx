import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/questions" }));

import { QuestionsView } from "@/components/app/QuestionsView";
import { exampleQuestions } from "@/components/app/example-data";

// X18 (UX plan PR 23): the dots get a legend (recognition over recall), and location tags are a neutral
// tag, so info blue stays for You / info (R2).
describe("Questions legend", () => {
  it("shows 'Named' and 'Not named' beside the same filled and hollow dots, above the list", () => {
    render(<QuestionsView data={exampleQuestions} />);
    const legend = screen.getByText("Named", { exact: true }).closest("[data-legend]")!;
    expect(legend).toHaveTextContent("Named");
    expect(legend).toHaveTextContent("Not named");
    const dots = [...legend.querySelectorAll("[data-dot]")];
    expect(dots.map((d) => d.getAttribute("data-dot"))).toEqual(["named", "not-named"]);
    expect(
      legend.compareDocumentPosition(screen.getAllByRole("listitem")[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The list uses the same dot component.
    expect(document.querySelectorAll('li [data-dot="named"]').length).toBeGreaterThan(0);
  });

  it("location tags are neutral, never info blue", () => {
    const { container } = render(<QuestionsView data={exampleQuestions} />);
    const tags = [...container.querySelectorAll("li .rounded-tag")];
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) {
      expect(t).toHaveClass("bg-raised");
      expect(t).not.toHaveClass("text-jellyDeep");
    }
  });
});
