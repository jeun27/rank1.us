import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FixList, type DoneView, type FixView } from "@/components/fixes/FixList";
import { fixCopy as c } from "@/components/fixes/copy";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";

// G5 (lead OK 2026-11-06): pillar groups in the check-off Fix list. Order P5 → P3 → P2 → P1 → P4 → P6, then
// P0 as one baseline line at the bottom; each group shows "{done}/{total}"; empty groups are hidden;
// Tidy-ups sit last inside P2. Labels from briefs/rank1-gas.md.
const fix = (id: string, title: string, pillar: FixView["pillar"], status: FixView["status"] = "todo"): FixView => ({
  ...exampleFixes[0],
  id,
  title,
  pillar,
  status,
});
const ranked = [
  fix("a", "Content fix one", "p2"),
  fix("b", "Robots fix", "p5"),
  fix("c", "Mentions fix", "p3"),
  fix("d", "Content fix two", "p2", "doing"),
  fix("e", "Prompt fix", "p1"),
];
const tidy = [{ ...exampleTidyUps[0], pillar: "p2" as const }];
const done: DoneView[] = [
  {
    id: "x",
    rule_key: "R10",
    title: "Done content fix",
    detail: null,
    status_changed_at: null,
    changed_by: null,
    pillar: "p2",
  },
  { id: "y", rule_key: "R14", title: "Done with no pillar", detail: null, status_changed_at: null, changed_by: null },
];
const baseline = { value: 80 / 240, numerator: 80, denominator: 240 };
const setup = (over: Partial<Parameters<typeof FixList>[0]> = {}) =>
  render(
    <FixList
      ranked={ranked}
      tidyUps={tidy}
      done={done}
      unchecked={[]}
      noDomain={false}
      canWrite
      onStatus={vi.fn()}
      baseline={baseline}
      baselineHref="/app"
      {...over}
    />,
  );
const groups = () => screen.getAllByRole("region").filter((r) => r.hasAttribute("data-pillar"));

describe("pillar groups", () => {
  it("in the fixed order P5, P3, P2, P1 (P4 and P6 have no fixes, so they're hidden), with the brief's labels", () => {
    setup();
    expect(groups().map((g) => g.getAttribute("data-pillar"))).toEqual(["p5", "p3", "p2", "p1"]);
    // S1 (review): the tag and the label read with a separator.
    for (const [g, p] of groups().map((g) => [g, g.getAttribute("data-pillar") as keyof typeof c.pillars] as const))
      expect(within(g).getAllByRole("heading")[0]).toHaveAccessibleName(`${p.toUpperCase()}: ${c.pillars[p]}`);
    expect(c.pillars).toEqual({
      p0: "Know where you stand",
      p1: "Prompts & keywords",
      p2: "Content",
      p3: "Brand mentions",
      p4: "YouTube & video",
      p5: "Technical access",
      p6: "Measure & prove",
    });
  });

  it("each group counts '{done}/{total}' (open + done with that pillar); a done fix with no pillar counts nowhere", () => {
    setup();
    const count = (p: string) =>
      within(groups().find((g) => g.getAttribute("data-pillar") === p)!).getByTestId("group-count");
    // P2: 2 open + 1 tidy-up + 1 done = 4, 1 done.
    expect(count("p2")).toHaveTextContent("1/4");
    expect(count("p5")).toHaveTextContent("0/1");
  });

  it("each group lists its own fixes; Tidy-ups sit last inside P2", () => {
    setup();
    const p2 = groups().find((g) => g.getAttribute("data-pillar") === "p2")!;
    const titles = within(p2)
      .getAllByRole("checkbox")
      .map((b) => b.getAttribute("aria-label"));
    expect(titles).toEqual(["Content fix one", "Content fix two", exampleTidyUps[0].title]);
    const tidyRegion = within(p2).getByRole("region", { name: c.tidyUps });
    expect(within(tidyRegion).getByRole("checkbox", { name: exampleTidyUps[0].title })).toBeInTheDocument();
    const p5 = groups().find((g) => g.getAttribute("data-pillar") === "p5")!;
    expect(
      within(p5)
        .getAllByRole("checkbox")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Robots fix"]);
  });

  it("P0 is one baseline line at the bottom, linking to the dashboard; none without a run", () => {
    const { unmount } = setup();
    const line = screen.getByText(c.baseline(baseline)).closest("[data-baseline]") as HTMLElement;
    expect(line).toHaveTextContent("Your baseline: 33% visibility, named in 80 of 240 answers.");
    expect(within(line).getByRole("link")).toHaveAttribute("href", "/app");
    expect(line.compareDocumentPosition(groups().at(-1)!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    unmount();
    setup({ baseline: null });
    expect(document.querySelector("[data-baseline]")).toBeNull();
  });

  // S2 (lead): a fully done group stays visible in Done and All (e.g. "1/1") and hides only in Open; done rows
  // sit in their group, and a done fix with no pillar is listed after the groups.
  it("Done and All show done rows inside their groups; a fully done group hides only in Open", async () => {
    const user = userEvent.setup();
    setup({
      done: [
        ...done,
        {
          id: "z",
          rule_key: "R10",
          title: "Done measure fix",
          detail: null,
          status_changed_at: null,
          changed_by: null,
          pillar: "p6",
        },
      ],
    });
    const pillarsShown = () => groups().map((g) => g.getAttribute("data-pillar"));
    expect(pillarsShown()).not.toContain("p6");
    await user.click(screen.getByRole("radio", { name: /Done/ }));
    expect(pillarsShown()).toEqual(["p2", "p6"]);
    const p6 = groups().find((g) => g.getAttribute("data-pillar") === "p6")!;
    expect(within(p6).getByTestId("group-count")).toHaveTextContent("1/1");
    expect(within(p6).getByRole("checkbox", { name: "Done measure fix" })).toHaveAttribute("aria-checked", "true");
    const p2 = groups().find((g) => g.getAttribute("data-pillar") === "p2")!;
    expect(within(p2).getByRole("checkbox", { name: "Done content fix" })).toBeInTheDocument();
    // The pillar-less done fix is still listed, outside the groups.
    const loose = screen.getByRole("checkbox", { name: "Done with no pillar" });
    expect(groups().some((g) => g.contains(loose))).toBe(false);
    await user.click(screen.getByRole("radio", { name: /All/ }));
    expect(pillarsShown()).toEqual(["p5", "p3", "p2", "p1", "p6"]);
  });

  it("without pillars (older fixtures) the list keeps its plain sections", () => {
    render(
      <FixList
        ranked={exampleFixes}
        tidyUps={exampleTidyUps}
        done={[]}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={vi.fn()}
      />,
    );
    expect(groups()).toHaveLength(0);
    expect(screen.getByRole("list", { name: c.title })).toBeInTheDocument();
  });
});

describe("copy", () => {
  it("COPY.md has the pillar labels and the baseline line", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of Object.values(c.pillars)) expect(copy, s).toContain(`"${s}"`);
    expect(copy).toContain('"Your baseline: {pct} visibility, named in {n} of {d} answers."');
  });
});
