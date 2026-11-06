import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "@/components/app/Page";

// X6 (UI.md D33): the page name is a label, not the answer. One 22/28 size at every width, -0.02em.
describe("app Page title", () => {
  it("is the 22/28 title size with no md step", () => {
    render(<Page title="Competitors">x</Page>);
    const h1 = screen.getByRole("heading", { level: 1, name: "Competitors" });
    expect(h1).toHaveClass("heading-gradient", "text-title", "font-semibold", "tracking-[-0.02em]");
    expect(h1.className).not.toMatch(/text-h2|md:text-/);
  });
});
