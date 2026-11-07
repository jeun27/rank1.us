import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompetitorSuggestions } from "@/components/app/CompetitorActions";

// Portal look (#104, lead): the Competitors "Add" / "Not a competitor" controls are 6px v3 controls
// (44px below md, 32px from md), not pills.
describe("Competitor suggestion controls", () => {
  it("Add and Not a competitor are 6px controls, never pills", () => {
    render(
      <CompetitorSuggestions
        suggestions={[{ name: "Example Pho Spot", domain: "examplepho.test", cid: "s1" }]}
        actions={{ add: vi.fn(async () => undefined), dismiss: vi.fn(async () => undefined) }}
      />,
    );
    // F2: the Add is named by its competitor.
    for (const name of ["Add Example Pho Spot", "Not a competitor"]) {
      const cls = screen.getByRole("button", { name }).className.split(" ");
      expect(cls, name).toEqual(expect.arrayContaining(["rounded-control", "h-11", "md:h-8"]));
      expect(cls, name).not.toContain("rounded-full");
    }
  });
});
