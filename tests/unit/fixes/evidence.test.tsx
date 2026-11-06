import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FixList } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";

// G2 (lead 2026-11-06): the AI access panel is the evidence inside a P5 fix. With X7 (#136, one fix open,
// the rest one line) it sits in the open fix's collapsible body, never on a one-line row.
describe("FixList evidence", () => {
  const list = () => {
    const first = { ...exampleFixes[0], id: "f1", title: "First fix", evidence: <p>First evidence</p> };
    const second = { ...exampleFixes[0], id: "f2", title: "Second fix", evidence: <p>Second evidence</p> };
    render(
      <FixList
        ranked={[first, second]}
        tidyUps={[]}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={vi.fn()}
      />,
    );
  };
  const row = (title: string) => screen.getByRole("checkbox", { name: title }).closest("li")!;

  it("the open fix shows its evidence in its body", () => {
    list();
    expect(within(row("First fix")).getByText("First evidence")).toBeVisible();
  });

  it("a one-line (collapsed) row keeps its evidence hidden in the collapsed body", () => {
    list();
    const evidence = within(row("Second fix")).getByText("Second evidence");
    expect(evidence).not.toBeVisible();
    expect(evidence.closest('[id$="-body"]')).toHaveAttribute("hidden");
  });
});
