import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FixList, type DoneView, type FixView } from "@/components/fixes/FixList";
import { fixCopy as c } from "@/components/fixes/copy";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";

// Portal (b), the check-off Fix list (lead OK 2026-11-06, mockup fixes-mock.html). The DB keeps todo / doing /
// done (set_fix_status); the done list and who/when come from backend's listDoneFixes / changed_by (#101).
const doing = (over: Partial<FixView> = {}): FixView => ({
  ...exampleFixes[2],
  status: "doing",
  status_changed_at: "2026-11-05T18:00:00Z",
  changed_by: { is_team: true, name: null },
  ...over,
});
const done: DoneView[] = [
  {
    id: "d1",
    rule_key: "H1",
    title: "Opening hours in the Business Profile",
    detail: "Your hours now match on Google and your site.",
    status_changed_at: "2026-11-04T19:00:00Z",
    changed_by: { is_team: false, name: "Ana" },
  },
];
const setup = (over: Partial<Parameters<typeof FixList>[0]> = {}) => {
  const onStatus = vi.fn(async () => undefined);
  render(
    <FixList
      ranked={[exampleFixes[0], exampleFixes[1], doing()]}
      tidyUps={exampleTidyUps}
      done={done}
      unchecked={[]}
      noDomain={false}
      canWrite
      onStatus={onStatus}
      {...over}
    />,
  );
  return { onStatus, user: userEvent.setup() };
};
const circle = (title: string) => screen.getByRole("checkbox", { name: title });
const row = (title: string) => circle(title).closest("li") as HTMLElement;

describe("the circle is a real checkbox", () => {
  it("named by the fix title; unchecked for To do, mixed for In progress, checked for Done", async () => {
    const { user } = setup();
    expect(circle(exampleFixes[0].title)).toHaveAttribute("aria-checked", "false");
    expect(circle(exampleFixes[2].title)).toHaveAttribute("aria-checked", "mixed");
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    expect(circle(done[0].title)).toHaveAttribute("aria-checked", "true");
  });

  it("the shortcut is in its tooltip and aria-keyshortcuts (no legend line)", () => {
    setup();
    const box = circle(exampleFixes[0].title);
    expect(box).toHaveAttribute("aria-keyshortcuts", "x");
    expect(box).toHaveAttribute("title", c.markDoneTip);
    const start = within(row(exampleFixes[0].title)).getByRole("button", { name: c.start });
    expect(start).toHaveAttribute("aria-keyshortcuts", "s");
    expect(start).toHaveAttribute("title", c.startTip);
    expect(document.body.textContent).not.toMatch(/click the circle to finish/);
  });

  it("click = done: onStatus(done), a 'Marked “…” done' toast with Undo, and Undo puts it back", async () => {
    const { onStatus, user } = setup();
    await user.click(circle(exampleFixes[0].title));
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[0].id, "done");
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent(c.marked(exampleFixes[0].title));
    await user.click(within(toast).getByRole("button", { name: c.undo }));
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[0].id, "todo");
    expect(circle(exampleFixes[0].title)).toHaveAttribute("aria-checked", "false");
  });

  it("Undo after finishing an in-progress fix returns it to In progress", async () => {
    const { onStatus, user } = setup();
    await user.click(circle(exampleFixes[2].title));
    await user.click(within(screen.getByRole("status")).getByRole("button", { name: c.undo }));
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[2].id, "doing");
  });

  it("keyboard: x marks the focused fix done, s starts it", async () => {
    const { onStatus, user } = setup();
    circle(exampleFixes[1].title).focus();
    await user.keyboard("s");
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[1].id, "doing");
    await user.keyboard("x");
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[1].id, "done");
  });
});

describe("Start and In progress", () => {
  it("Start (To do only) sets doing: a half circle and 'In progress'", async () => {
    const { onStatus, user } = setup();
    expect(within(row(exampleFixes[2].title)).queryByRole("button", { name: c.start })).toBeNull();
    await user.click(within(row(exampleFixes[0].title)).getByRole("button", { name: c.start }));
    expect(onStatus).toHaveBeenLastCalledWith(exampleFixes[0].id, "doing");
    expect(circle(exampleFixes[0].title)).toHaveAttribute("aria-checked", "mixed");
    expect(within(row(exampleFixes[0].title)).getByText(c.inProgress)).toBeInTheDocument();
  });

  it("who/when: 'Rank1 team' for a team actor, the member's name otherwise, never an email; none when null", () => {
    const { unmount } = render(
      <FixList ranked={[doing()]} tidyUps={[]} done={[]} unchecked={[]} noDomain={false} canWrite onStatus={vi.fn()} />,
    );
    expect(within(row(exampleFixes[2].title)).getByText(`${c.rankTeam} · Nov 5`)).toBeInTheDocument();
    unmount();
    const r = render(
      <FixList
        ranked={[doing({ changed_by: { is_team: false, name: "Ana" } })]}
        tidyUps={[]}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={vi.fn()}
      />,
    );
    expect(within(row(exampleFixes[2].title)).getByText("Ana · Nov 5")).toBeInTheDocument();
    r.unmount();
    render(
      <FixList
        ranked={[doing({ changed_by: null, status_changed_at: null })]}
        tidyUps={[]}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={vi.fn()}
      />,
    );
    expect(within(row(exampleFixes[2].title)).getByText(c.inProgress)).toBeInTheDocument();
    expect(within(row(exampleFixes[2].title)).queryByText(/·/)).toBeNull();
  });
});

describe("progress, tabs and the done list", () => {
  it("'{done} of {total} done' with a bar; Open / Done / All tabs with counts", async () => {
    const { user } = setup();
    // 4 open + 1 done.
    expect(screen.getByText(c.progress(1, 5))).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: c.progress(1, 5) });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    const tabs = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(tabs.map((t) => t.textContent)).toEqual([`${c.open}4`, `${c.doneTab}1`, c.all]);
    expect(tabs[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("checkbox", { name: done[0].title })).toBeNull();
    await user.click(tabs[2]);
    expect(circle(done[0].title)).toBeInTheDocument();
    expect(circle(exampleFixes[0].title)).toBeInTheDocument();
  });

  it("done rows are struck through with 'Done {date}' and the actor, and Undo reopens them", async () => {
    const { onStatus, user } = setup();
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    const r = row(done[0].title);
    expect(within(r).getByText(done[0].title)).toHaveClass("line-through");
    expect(within(r).getByText(`${c.doneOn("Nov 4")} · Ana`)).toBeInTheDocument();
    await user.click(within(r).getByRole("button", { name: c.undo }));
    expect(onStatus).toHaveBeenLastCalledWith("d1", "todo");
  });

  it("a fix closed by the weekly check (changed_by null) shows only the date", async () => {
    const { user } = setup({ done: [{ ...done[0], changed_by: null }] });
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    expect(within(row(done[0].title)).getByText(c.doneOn("Nov 4"))).toBeInTheDocument();
  });

  // A segmented control (UI.md), not tabs: the team workspace already wraps it in a document tabpanel.
  it("the Open / Done / All filter moves with the arrow keys", async () => {
    const { user } = setup();
    screen.getByRole("radio", { name: /Open/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Done/ })).toHaveFocus();
    expect(screen.getByRole("radio", { name: /Done/ })).toHaveAttribute("aria-checked", "true");
  });

  it("each group keeps its heading and shows its count; the pillar slot is empty until G5", () => {
    setup();
    expect(screen.getByRole("list", { name: c.title })).toBeInTheDocument();
    const tidy = screen.getByRole("region", { name: c.tidyUps });
    expect(within(tidy).getByTestId("group-count")).toHaveTextContent("1");
    expect(document.querySelectorAll("[data-pillar]").length).toBe(0);
  });
});

describe("read-only (a DFY client) and failures", () => {
  it("without canWrite: the circles are status only, no Start or Undo, done rows still listed", async () => {
    const user = userEvent.setup();
    render(
      <FixList
        ranked={[exampleFixes[0], doing()]}
        tidyUps={[]}
        done={done}
        unchecked={[]}
        noDomain={false}
        canWrite={false}
      />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByRole("img", { name: `${exampleFixes[0].title}: ${c.statuses.todo}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.start })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    expect(screen.getByText(done[0].title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.undo })).toBeNull();
  });

  it("a refused write reverts the row and shows the save error", async () => {
    const onStatus = vi.fn(async () => ({ error: "42501" }));
    const user = userEvent.setup();
    render(
      <FixList
        ranked={[exampleFixes[0]]}
        tidyUps={[]}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={onStatus}
      />,
    );
    await user.click(circle(exampleFixes[0].title));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.saveFailed);
    expect(circle(exampleFixes[0].title)).toHaveAttribute("aria-checked", "false");
  });

  // Fake timers only (no self-advancing clock), fireEvent instead of userEvent, so the 8 s is exact.
  it("the toast goes away by itself", async () => {
    vi.useFakeTimers();
    try {
      render(
        <FixList
          ranked={[exampleFixes[0]]}
          tidyUps={[]}
          done={[]}
          unchecked={[]}
          noDomain={false}
          canWrite
          onStatus={vi.fn()}
        />,
      );
      await act(async () => {
        fireEvent.click(circle(exampleFixes[0].title));
      });
      expect(screen.getByRole("status")).toHaveTextContent(c.marked(exampleFixes[0].title));
      await act(async () => {
        vi.advanceTimersByTime(7999);
      });
      expect(screen.getByRole("status")).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("copy", () => {
  it("COPY.md 'Fix list (lead, 2026-11-06)' has every new string", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    const at = copy.indexOf("## Fix list (lead, 2026-11-06)");
    expect(at).toBeGreaterThan(-1);
    const section = copy.slice(at, copy.indexOf("\n## ", at + 5));
    for (const s of [c.start, c.inProgress, c.undo, c.open, c.all, c.rankTeam, c.markDoneTip, c.startTip])
      expect(section, s).toContain(`"${s}"`);
    for (const s of ['"Done {date}"', '"Marked “{title}” done"', '"{done} of {total} done"'])
      expect(section).toContain(s);
  });
});
