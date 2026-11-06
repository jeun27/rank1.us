import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FixList, type DoneView } from "@/components/fixes/FixList";
import { fixCopy as c } from "@/components/fixes/copy";
import { exampleFixes } from "@/components/fixes/example-data";

// X27 (UX plan PR 8): a before/after test only makes sense once something changed, so "Start a before/after
// test" is offered when a fix is done (the toast and done rows), not on every open fix. Owners only.
const done: DoneView[] = [
  { id: "d1", rule_key: "R1", title: "Hours fixed", detail: "Done", status_changed_at: null, changed_by: null },
];
const link = (id: string) => `/app/experiments/new?fix=${id}`;
const setup = (canWrite = true) => {
  const onStatus = vi.fn(async () => undefined);
  render(
    <FixList
      ranked={exampleFixes}
      tidyUps={[]}
      done={done}
      unchecked={[]}
      noDomain={false}
      canWrite={canWrite}
      onStatus={canWrite ? onStatus : undefined}
    />,
  );
  return userEvent.setup();
};

describe("Start a before/after test, when a fix is done", () => {
  it("is not on open fixes, even opened", async () => {
    const user = setup();
    for (const b of screen.getAllByRole("button", { expanded: false })) await user.click(b);
    expect(screen.queryByRole("link", { name: c.startTest })).toBeNull();
  });

  it("is in the toast right after marking a fix done, with that fix's id", async () => {
    const user = setup();
    await user.click(screen.getByRole("checkbox", { name: exampleFixes[0].title }));
    const toast = screen.getByRole("status");
    expect(within(toast).getByRole("link", { name: c.startTest })).toHaveAttribute("href", link(exampleFixes[0].id));
  });

  it("is on a done row once opened", async () => {
    const user = setup();
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    await user.click(screen.getByRole("button", { name: "Hours fixed", expanded: false }));
    expect(screen.getByRole("link", { name: c.startTest })).toHaveAttribute("href", link("d1"));
  });

  it("is never shown without canWrite", async () => {
    const user = setup(false);
    await user.click(screen.getByRole("radio", { name: /All/ }));
    for (const b of screen.getAllByRole("button", { expanded: false })) await user.click(b);
    expect(screen.queryByRole("link", { name: c.startTest })).toBeNull();
  });
});
