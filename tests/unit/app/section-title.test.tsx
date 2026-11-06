import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page, Section } from "@/components/app/Page";
import { Card } from "@/components/ui/Card";

// F1 (UI.md type table): section and card titles are Inter 500 13/18, under the 22/28 page title; app
// body text is the 13/19 UI size.
describe("app type scale", () => {
  it("Section h2 and Card h3 are text-section font-medium", () => {
    render(
      <Page title="Dashboard">
        <Section title="Visibility">x</Section>
        <Card title="Share of voice">y</Card>
      </Page>,
    );
    for (const h of [screen.getByRole("heading", { level: 2 }), screen.getByRole("heading", { level: 3 })]) {
      expect(h).toHaveClass("text-section", "font-medium");
      expect(h.className).not.toMatch(/text-h3|font-semibold/);
    }
    expect(screen.getByRole("main")).toHaveClass("text-ui");
  });
});
