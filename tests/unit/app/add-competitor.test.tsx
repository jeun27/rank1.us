import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/competitors" }));

import { AddCompetitorForm } from "@/components/app/CompetitorActions";
import { CompetitorsView } from "@/components/app/CompetitorsView";
import { exampleLatest, exampleTracked } from "@/components/app/example-data";

const now = new Date("2026-11-05T12:00:00Z");
const actions = () => ({ add: vi.fn(async () => undefined), dismiss: vi.fn(async () => undefined) });

// X26 (UX plan PR 10): the manual add form shows when it's the next step. With competitors already
// tracked it sits behind an "Add competitor" text action, and the form's own submit is "Add" (one "Add
// competitor" on the page). Add stays enabled; an empty submit says why (WCAG 3.3.1) and puts the cursor in Name.
describe("add a competitor when it's relevant", () => {
  it("with competitors: the form is folded behind 'Add competitor'", () => {
    const { container } = render(
      <CompetitorsView
        latest={exampleLatest}
        tracked={exampleTracked}
        suggestions={[]}
        actions={actions()}
        now={now}
      />,
    );
    const fold = container.querySelector("details")!;
    expect(fold).not.toHaveAttribute("open");
    expect(fold.querySelector("summary")).toHaveTextContent("Add competitor");
    expect(fold).toContainElement(screen.getByLabelText("Name"));
  });

  it("with none yet: the form is open, after the empty line", () => {
    const { container } = render(
      <CompetitorsView latest={null} tracked={[]} suggestions={[]} actions={actions()} now={now} />,
    );
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByLabelText("Name")).toBeVisible();
  });

  it("an empty submit doesn't add, says 'Add a name first.' under Name, and puts focus there", async () => {
    const a = actions();
    render(<AddCompetitorForm add={a.add} />);
    const submit = screen.getByRole("button", { name: "Add" });
    expect(submit).toBeEnabled();
    expect(screen.queryByText("Add a name first.")).toBeNull();
    await userEvent.click(submit);
    expect(a.add).not.toHaveBeenCalled();
    const field = screen.getByLabelText("Name");
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription("Add a name first.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    // Typing the name clears the reason.
    await userEvent.type(field, "Example Soba Stand");
    expect(field).not.toHaveAccessibleDescription("Add a name first.");
    expect(screen.queryByText("Add a name first.")).toBeNull();
  });

  it("opened from the fold: the disclosure is 'Add competitor' and the submit is 'Add'", async () => {
    const { container } = render(
      <CompetitorsView
        latest={exampleLatest}
        tracked={exampleTracked}
        suggestions={[]}
        actions={actions()}
        now={now}
      />,
    );
    await userEvent.click(container.querySelector("summary")!);
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(screen.getAllByText("Add competitor", { exact: true })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Add competitor" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add" })).toBeVisible();
  });
});
