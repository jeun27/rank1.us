import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExperimentList, type ExperimentCardView } from "@/components/experiments/ExperimentList";
import { experimentCopy as c } from "@/components/experiments/copy";
import { computeExperiment } from "@/lib/metrics/experiment";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/experiments" }));

// X14 + X29 (UX plan S9, L4): the verdict is read second, right after the name; "Delete test" is a
// far-right text action that confirms inline (no modal): focus goes to Cancel, Escape returns it.
const result = computeExperiment({
  test: { before: { named: 40, n: 120 }, after: { named: 52, n: 120 } },
  control: { before: { named: 30, n: 100 }, after: { named: 33, n: 100 } },
});
const card: ExperimentCardView = {
  id: "e1",
  name: "New menu page",
  changeDate: "2026-10-20",
  status: "running",
  result,
};
const setup = () => {
  const actions = { end: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  render(<ExperimentList experiments={[card]} canWrite actions={actions} />);
  return { actions, art: screen.getByRole("article") };
};

describe("experiment card: verdict first, delete in place", () => {
  it("puts the difference line right after the header, before the table", () => {
    const { art } = setup();
    const verdict = within(art).getByText(c.difference).parentElement!;
    expect(verdict.previousElementSibling?.tagName).toBe("HEADER");
    const table = within(art).getByRole("table", { name: "New menu page" });
    expect(verdict.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("End test stays a button; Delete test is a text action pushed to the far right", () => {
    const { art } = setup();
    const del = within(art).getByRole("button", { name: c.remove });
    expect(del).toHaveClass("ml-auto", "underline");
    expect(del.className).not.toMatch(/\bborder\b/);
    expect(within(art).getByRole("button", { name: c.end })).toBeInTheDocument();
  });

  it("confirms inline: no dialog, focus on Cancel, Cancel and Escape put focus back on Delete test", async () => {
    const { actions, art } = setup();
    await userEvent.click(within(art).getByRole("button", { name: c.remove }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const confirm = within(art).getByRole("group", { name: c.confirmDelete });
    expect(within(confirm).getByRole("button", { name: c.cancel })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(within(art).queryByRole("group")).not.toBeInTheDocument();
    expect(within(art).getByRole("button", { name: c.remove })).toHaveFocus();
    await userEvent.click(within(art).getByRole("button", { name: c.remove }));
    await userEvent.click(within(art).getByRole("button", { name: c.cancel }));
    expect(within(art).getByRole("button", { name: c.remove })).toHaveFocus();
    expect(actions.remove).not.toHaveBeenCalled();
  });

  it("the inline Delete test deletes", async () => {
    const { actions, art } = setup();
    await userEvent.click(within(art).getByRole("button", { name: c.remove }));
    const confirm = within(art).getByRole("group", { name: c.confirmDelete });
    await userEvent.click(within(confirm).getByRole("button", { name: c.remove }));
    expect(actions.remove).toHaveBeenCalledWith("e1");
  });
});

// #141 review: the destructive confirm reads as danger, and the verdict's delta is the #126 state badge.
describe("experiment card polish", () => {
  it("the inline Delete test uses the danger style; focus still lands on Cancel", async () => {
    const { art } = setup();
    await userEvent.click(within(art).getByRole("button", { name: c.remove }));
    const confirm = within(art).getByRole("group", { name: c.confirmDelete });
    expect(within(confirm).getByRole("button", { name: c.remove })).toHaveClass("bg-errorBg", "text-brick");
    expect(within(confirm).getByRole("button", { name: c.cancel })).toHaveFocus();
  });

  it("the verdict delta is a mono state badge (+7 pts → success)", () => {
    const { art } = setup();
    const delta = within(art).getByText("+7 pts");
    expect(delta).toHaveClass("rounded-tag", "font-mono", "text-moss");
  });
});
