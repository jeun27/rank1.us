import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FixList } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";

// G2 (lead 2026-11-06): the AI access panel is the evidence inside the P5 fixes' rows (open rows only).
describe("FixList evidence", () => {
  it("an open fix renders its evidence in its row", () => {
    const open = { ...exampleFixes[0], id: "f1", title: "Open fix", evidence: <p>Evidence panel</p> };
    render(
      <FixList ranked={[open]} tidyUps={[]} done={[]} unchecked={[]} noDomain={false} canWrite onStatus={vi.fn()} />,
    );
    const row = screen.getByRole("checkbox", { name: "Open fix" }).closest("li")!;
    expect(within(row).getByText("Evidence panel")).toBeInTheDocument();
  });
});
