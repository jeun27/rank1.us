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
// tracked it sits behind an "Add competitor" text action; Add stays enabled and an empty submit puts the
// cursor in Name (no new string).
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

  it("an empty submit doesn't add and puts focus in Name; Add stays enabled", async () => {
    const a = actions();
    render(<AddCompetitorForm add={a.add} />);
    const submit = screen.getByRole("button", { name: "Add competitor" });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(a.add).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });
});
