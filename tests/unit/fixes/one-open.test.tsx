import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FixList, type DoneView, type FixView } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";

// X7 (UX plan S10, L2): one fix open (the first open fix in the Fix list order, the Dashboard card's),
// the rest one line: check-off, title as a disclosure button, affected n. A #fix-{id} hash opens that fix.
const fix = (id: string, title: string, pillar: FixView["pillar"], status: FixView["status"] = "todo"): FixView => ({
  ...exampleFixes[0],
  id,
  title,
  detail: `Evidence for ${title}`,
  affected_answers: 12,
  pillar,
  status,
});
const ranked = [fix("a", "Content fix", "p2"), fix("b", "Robots fix", "p5"), fix("c", "Mentions fix", "p3")];
const done: DoneView[] = [
  {
    id: "x",
    rule_key: "R10",
    title: "Done fix",
    detail: "Done evidence",
    status_changed_at: null,
    changed_by: null,
    pillar: "p5",
  },
];
const setup = (over: Partial<Parameters<typeof FixList>[0]> = {}) => {
  const onStatus = vi.fn(async () => undefined);
  render(
    <FixList
      ranked={ranked}
      tidyUps={[]}
      done={done}
      unchecked={[]}
      noDomain={false}
      canWrite
      onStatus={onStatus}
      {...over}
    />,
  );
  return { onStatus };
};
const title = (name: string) => screen.getByRole("button", { name, expanded: undefined });

afterEach(() => window.history.replaceState(null, "", "/"));

describe("Fix list: one open, the rest one line", () => {
  it("opens the first open fix of the first group (P5) and collapses the others", () => {
    setup();
    expect(title("Robots fix")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Evidence for Robots fix")).toBeVisible();
    for (const t of ["Mentions fix", "Content fix"]) {
      expect(title(t)).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByText(`Evidence for ${t}`)).not.toBeVisible();
    }
    // Collapsed rows still show the affected count on their one line.
    const row = title("Mentions fix").closest("li")!;
    expect(within(row).getByText("12 affected answers")).toBeVisible();
  });

  it("Enter or a click on a title toggles it; focus stays on the title; any number can be open", async () => {
    setup();
    const t = title("Mentions fix");
    t.focus();
    await userEvent.keyboard("{Enter}");
    expect(t).toHaveAttribute("aria-expanded", "true");
    expect(t).toHaveFocus();
    expect(title("Robots fix")).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(t.getAttribute("aria-controls")!)).toBeVisible();
    await userEvent.click(t);
    expect(t).toHaveAttribute("aria-expanded", "false");
  });

  it("x on a collapsed row still marks it done; its check-off is on the one line", async () => {
    const { onStatus } = setup();
    const row = title("Content fix").closest("li")!;
    expect(within(row).getByRole("checkbox", { name: "Content fix" })).toBeVisible();
    title("Content fix").focus();
    await userEvent.keyboard("x");
    expect(onStatus).toHaveBeenCalledWith("a", "done");
  });

  it("done rows start collapsed", async () => {
    setup();
    await userEvent.click(screen.getByRole("radio", { name: /All/ }));
    expect(title("Done fix")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Done evidence")).not.toBeVisible();
  });

  it("a #fix-{id} hash opens that fix, gives it the row id and focuses its title", async () => {
    window.history.replaceState(null, "", "/app/fixes#fix-c");
    Element.prototype.scrollIntoView = vi.fn();
    await act(async () => setup());
    expect(title("Mentions fix")).toHaveAttribute("aria-expanded", "true");
    expect(title("Mentions fix")).toHaveFocus();
    expect(title("Mentions fix").closest("li")).toHaveAttribute("id", "fix-c");
  });

  it("read-only (/client): the same rows, status as an image, and expanding still works", async () => {
    setup({ canWrite: false, onStatus: undefined });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mentions fix: To do" })).toBeInTheDocument();
    await userEvent.click(title("Mentions fix"));
    expect(screen.getByText("Evidence for Mentions fix")).toBeVisible();
  });
});
