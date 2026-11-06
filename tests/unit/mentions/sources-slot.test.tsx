import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourcesView } from "@/components/app/SourcesView";
import { sourcesCopy } from "@/components/app/sources-copy";

// G7: the mentions section is the first thing on /app/sources (PR22's slot), even before the first run.
describe("SourcesView mentions slot", () => {
  it("renders the slot at the top, before the empty state", () => {
    render(<SourcesView sources={null} location={undefined} mentions={<section aria-label="Mentions">m</section>} />);
    const slot = screen.getByRole("region", { name: "Mentions" });
    const empty = screen.getByText(sourcesCopy.empty);
    expect(slot.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
