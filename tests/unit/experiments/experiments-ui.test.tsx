import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExperimentForm } from "@/components/experiments/ExperimentForm";
import { ExperimentList, type ExperimentCardView } from "@/components/experiments/ExperimentList";
import { experimentCopy as c } from "@/components/experiments/copy";
import { FixList } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";
import { computeExperiment } from "@/lib/metrics/experiment";
import { experimentsTarget } from "@/lib/supabase/middleware";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/experiments" }));

// Step 17 frontend (lead OK 2026-11-06): one page of cards, Before / After as "34% · n=…", Change and
// Difference as signed floored points, "Directional", no p-values. Writes only with canWrite.
const result = computeExperiment({
  test: { before: { named: 40, n: 120 }, after: { named: 52, n: 120 } },
  control: { before: { named: 30, n: 100 }, after: { named: 33, n: 100 } },
});
const card = (over: Partial<ExperimentCardView> = {}): ExperimentCardView => ({
  id: "e1",
  name: "New menu page",
  changeDate: "2026-10-20",
  status: "running",
  result,
  ...over,
});
const actions = () => ({ end: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) });

describe("results (UI.md 4b Experiments success)", () => {
  it("Before / After are '34% · n=…' per group; Change and Difference are signed floored points", () => {
    render(<ExperimentList experiments={[card()]} canWrite actions={actions()} />);
    const table = screen.getByRole("table", { name: "New menu page" });
    const rows = within(table)
      .getAllByRole("row")
      .filter((r) => within(r).queryByRole("rowheader"))
      .map((r) =>
        within(r)
          .getAllByRole("cell")
          .map((td) => td.textContent),
      );
    // 40/120 = 33%, 52/120 = 43% (+10); 30/100 = 30%, 33/100 = 33% (+3); difference +7.
    expect(rows).toEqual([
      ["33% · n=120", "43% · n=120", "+10 pts"],
      ["30% · n=100", "33% · n=100", "+3 pts"],
    ]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((h) => h.textContent),
    ).toEqual([c.testQuestions, c.controlQuestions]);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual([c.before, c.after, c.change]);
    const art = screen.getByRole("article");
    expect(within(art).getByText(c.difference).parentElement).toHaveTextContent(`${c.difference}+7 pts`);
    expect(within(art).getByText("Directional")).toBeInTheDocument();
    // Point values never carry a %; no significance language anywhere.
    expect(art.textContent).not.toMatch(/pts?%|% pts|p-value|p =|signific|confiden/i);
  });

  it("a negative change uses a minus sign; zero has no sign", () => {
    const r = computeExperiment({
      test: { before: { named: 50, n: 100 }, after: { named: 40, n: 100 } },
      control: { before: { named: 20, n: 100 }, after: { named: 20, n: 100 } },
    });
    render(<ExperimentList experiments={[card({ result: r })]} canWrite actions={actions()} />);
    const cells = screen.getAllByRole("cell").map((td) => td.textContent);
    expect(cells).toContain("−10 pts");
    expect(cells).toContain("0 pts");
    expect(screen.getByText(c.difference).parentElement).toHaveTextContent("−10 pts");
  });

  it("too few answers (any cell n < 10): the partial copy instead of numbers", () => {
    const r = computeExperiment({
      test: { before: { named: 3, n: 9 }, after: { named: 5, n: 40 } },
      control: { before: { named: 3, n: 40 }, after: { named: 3, n: 40 } },
    });
    render(<ExperimentList experiments={[card({ result: r })]} canWrite actions={actions()} />);
    expect(screen.getByText("Too few answers to call yet. Next check Monday.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/pts/)).toBeNull();
  });

  it("status tags: Running / Done / Ended", () => {
    render(
      <ExperimentList
        experiments={[
          card({ id: "a", status: "running" }),
          card({ id: "b", name: "Hours page", status: "done" }),
          card({ id: "c", name: "FAQ block", status: "ended" }),
        ]}
        canWrite
        actions={actions()}
      />,
    );
    expect(screen.getAllByRole("article").map((a) => within(a).getByTestId("status").textContent)).toEqual([
      c.statuses.running,
      c.statuses.done,
      c.statuses.ended,
    ]);
    expect(c.statuses).toEqual({ running: "Running", done: "Done", ended: "Ended" });
  });
});

describe("states and the canWrite gate", () => {
  it("empty: the 4b copy and 'Start a test' to the form", () => {
    render(<ExperimentList experiments={[]} canWrite actions={actions()} />);
    expect(screen.getByText("Changed a page? Test it against questions you didn't change.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a test" })).toHaveAttribute("href", "/app/experiments/new");
  });

  it("without canWrite: no 'Start a test', no End test, no Delete test", () => {
    const { rerender } = render(<ExperimentList experiments={[]} canWrite={false} />);
    expect(screen.queryByRole("link", { name: "Start a test" })).toBeNull();
    rerender(<ExperimentList experiments={[card()]} canWrite={false} />);
    expect(screen.queryByRole("link", { name: "Start a test" })).toBeNull();
    expect(screen.queryByRole("button", { name: c.end })).toBeNull();
    expect(screen.queryByRole("button", { name: c.remove })).toBeNull();
  });

  it("End test shows only while running and ends it", async () => {
    const a = actions();
    render(
      <ExperimentList
        experiments={[card({ id: "run" }), card({ id: "fin", name: "Hours page", status: "done" })]}
        canWrite
        actions={a}
      />,
    );
    const [running, done] = screen.getAllByRole("article");
    expect(within(done).queryByRole("button", { name: c.end })).toBeNull();
    await userEvent.click(within(running).getByRole("button", { name: c.end }));
    expect(a.end).toHaveBeenCalledWith("run");
  });

  it("Delete test asks first ('Delete this test? Its results go too.'), then deletes", async () => {
    const a = actions();
    render(<ExperimentList experiments={[card()]} canWrite actions={a} />);
    await userEvent.click(screen.getByRole("button", { name: c.remove }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete this test? Its results go too.");
    expect(a.remove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: c.remove }));
    expect(a.remove).toHaveBeenCalledWith("e1");
  });

  it("a failed end or delete shows the save error, not a silent no-op", async () => {
    const a = { end: vi.fn(async () => ({ error: "failed" })), remove: vi.fn(async () => undefined) };
    render(<ExperimentList experiments={[card()]} canWrite actions={a} />);
    await userEvent.click(screen.getByRole("button", { name: c.end }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.saveFailed);
  });
});

const questions = [
  { id: "q1", text: "best ramen in Irvine" },
  { id: "q2", text: "ramen near Irvine Spectrum Center" },
  { id: "q3", text: "late night ramen in Irvine" },
];

describe("'Start a test' form", () => {
  const setup = (over: Partial<Parameters<typeof ExperimentForm>[0]> = {}) => {
    const onCreate = vi.fn(async () => undefined);
    render(<ExperimentForm questions={questions} today="2026-11-06" onCreate={onCreate} {...over} />);
    const test = screen.getByRole("group", { name: c.testQuestions });
    const control = screen.getByRole("group", { name: c.controlQuestions });
    return { onCreate, test, control, user: userEvent.setup() };
  };

  it("has the lead fields; the change date defaults to today (LA); control starts as every question", () => {
    const { test, control } = setup();
    for (const label of [c.name, c.whatChanged, c.link, c.changeDate])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText(c.changeDate)).toHaveValue("2026-11-06");
    expect(screen.getByLabelText(c.changeDate)).toHaveAttribute("max", "2026-11-06");
    expect(
      within(test)
        .getAllByRole("checkbox")
        .every((b) => !(b as HTMLInputElement).checked),
    ).toBe(true);
    expect(
      within(control)
        .getAllByRole("checkbox")
        .every((b) => (b as HTMLInputElement).checked),
    ).toBe(true);
  });

  it("a question is in one group only: ticking it in Test unticks it in Control, and back", async () => {
    const { test, control, user } = setup();
    await user.click(within(test).getByRole("checkbox", { name: questions[0].text }));
    expect(within(control).getByRole("checkbox", { name: questions[0].text })).not.toBeChecked();
    await user.click(within(control).getByRole("checkbox", { name: questions[0].text }));
    expect(within(test).getByRole("checkbox", { name: questions[0].text })).not.toBeChecked();
  });

  it("blocks submit without a test question, without a control question, or with a non-http link", async () => {
    const { test, control, onCreate, user } = setup();
    await user.type(screen.getByLabelText(c.name), "New menu page");
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(screen.getByText("Pick at least 1 test question.")).toBeInTheDocument();
    for (const q of questions) await user.click(within(test).getByRole("checkbox", { name: q.text }));
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(screen.getByText("Pick at least 1 control question.")).toBeInTheDocument();
    await user.click(within(control).getByRole("checkbox", { name: questions[2].text }));
    await user.type(screen.getByLabelText(c.link), "ftp://example.test/menu");
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(screen.getByText("Use a link that starts with http:// or https://.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("submits the groups and fields; an empty link is left out", async () => {
    const { test, onCreate, user } = setup();
    await user.type(screen.getByLabelText(c.name), "New menu page");
    await user.type(screen.getByLabelText(c.whatChanged), "Added an HTML menu");
    await user.click(within(test).getByRole("checkbox", { name: questions[0].text }));
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(onCreate).toHaveBeenCalledWith({
      name: "New menu page",
      changeNote: "Added an HTML menu",
      changeUrl: null,
      changeDate: "2026-11-06",
      test: ["q1"],
      control: ["q2", "q3"],
      fixId: null,
    });
  });

  it("from a fix: the name defaults to the fix title and fix_id is sent", async () => {
    const { test, onCreate, user } = setup({ fix: { id: "f9", title: "Crawlable HTML menu on your own site" } });
    expect(screen.getByLabelText(c.name)).toHaveValue("Crawlable HTML menu on your own site");
    await user.click(within(test).getByRole("checkbox", { name: questions[1].text }));
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ fixId: "f9", test: ["q2"] }));
  });

  it("a refused save shows the matching message", async () => {
    const onCreate = vi.fn(async () => ({ error: "failed" as const }));
    const { test, user } = setup({ onCreate });
    await user.type(screen.getByLabelText(c.name), "x");
    await user.click(within(test).getByRole("checkbox", { name: questions[0].text }));
    await user.click(screen.getByRole("button", { name: "Start a test" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.saveFailed);
  });
});

describe("Fix list: 'Start a before/after test' (on since Step 17)", () => {
  // X7: collapsed rows keep the link inside the fix's body, so open each one first.
  it("each fix links to the form with its id, only with canWrite", async () => {
    const { rerender } = render(
      <FixList ranked={exampleFixes} tidyUps={[]} unchecked={[]} noDomain={false} canWrite onStatus={vi.fn()} />,
    );
    for (const b of screen.getAllByRole("button", { expanded: false })) await userEvent.click(b);
    const links = screen.getAllByRole("link", { name: "Start a before/after test" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      exampleFixes.map((f) => `/app/experiments/new?fix=${f.id}`),
    );
    rerender(<FixList ranked={exampleFixes} tidyUps={[]} unchecked={[]} noDomain={false} canWrite={false} />);
    expect(screen.queryByRole("link", { name: "Start a before/after test" })).toBeNull();
  });
});

describe("the dfy_client 404 gate (proxy)", () => {
  it("matches /app/experiments and /app/experiments/new only, on the normalized path", () => {
    for (const p of [
      "/app/experiments",
      "/app/experiments/",
      "/app/experiments/new",
      "/APP/Experiments",
      "//app/./experiments/new",
    ])
      expect(experimentsTarget(p), p).toBe(true);
    for (const p of ["/app", "/app/experimentsx", "/app/experiments/new/x", "/client/experiments", "/app/fixes"])
      expect(experimentsTarget(p), p).toBe(false);
  });
});

describe("copy", () => {
  it("COPY.md has 'Experiments (lead, 2026-11-05)' with the brief's and the approved strings", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    const section = copy.slice(copy.indexOf("## Experiments (lead, 2026-11-05)"));
    expect(copy).toContain("## Experiments (lead, 2026-11-05)");
    for (const s of [
      c.name,
      c.whatChanged,
      c.link,
      c.changeDate,
      c.testQuestions,
      c.controlQuestions,
      c.end,
      c.remove,
      c.before,
      c.after,
      c.change,
      c.difference,
      ...Object.values(c.statuses),
      c.errors.test,
      c.errors.control,
      c.errors.link,
      c.confirmDelete,
    ])
      expect(section, s).toContain(`"${s}"`);
  });
});
