import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FixList } from "@/components/fixes/FixList";
import { fixCopy } from "@/components/fixes/copy";
import { exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";
import { ProgressBar } from "@/components/ui/ProgressBar";

// v3 component drift (lead, 2026-11-06): ProgressBar (C1) and the FixList status select (C4) per UI.md.
describe("ProgressBar (UI.md Loading + progress)", () => {
  it("a 6px overlay track with an accent fill sized by scaleX; n of d muted left, the floored percent in link colour right, both mono", () => {
    render(<ProgressBar done={120} total={250} />);
    const bar = screen.getByRole("progressbar", { name: "120 of 250 answers" });
    const track = bar.className.split(" ");
    for (const c of ["h-1.5", "rounded-full", "bg-overlay"]) expect(track).toContain(c);
    expect(bar.className).not.toMatch(/\bborder\b|\bh-3\b|bg-white/);
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.className.split(" ")).toEqual(expect.arrayContaining(["h-full", "w-full", "origin-left", "bg-accent"]));
    expect(fill.style.transform).toBe("scaleX(0.48)");
    expect(fill.style.width).toBe("");
    const label = screen.getByText("120 of 250 answers");
    const pct = screen.getByText("48%");
    expect(label.className.split(" ")).toEqual(expect.arrayContaining(["font-mono", "text-inkMuted"]));
    expect(pct.className.split(" ")).toEqual(expect.arrayContaining(["font-mono", "text-jellyDeep"]));
  });
});

describe("FixList controls (UI.md: radius 6, 44px below md, 32px from md)", () => {
  // Portal (b): the Status select became the circle checkbox; Start is the 6px control now.
  it("Start is a 6px control, not a pill", () => {
    render(
      <FixList
        ranked={exampleFixes}
        tidyUps={exampleTidyUps}
        unchecked={[]}
        noDomain={false}
        canWrite
        onStatus={vi.fn()}
      />,
    );
    const start = screen.getAllByRole("button", { name: fixCopy.start })[0];
    expect(start.className.split(" ")).toEqual(expect.arrayContaining(["rounded-control", "h-11", "md:h-8"]));
    expect(start.className).not.toContain("rounded-full");
  });

  it("read-only (client view): the circle is a status image, not a control", () => {
    render(<FixList ranked={exampleFixes} tidyUps={[]} unchecked={[]} noDomain={false} canWrite={false} />);
    const card = within(screen.getByRole("list", { name: "What to fix next" })).getAllByRole("listitem")[0];
    expect(within(card).getByRole("img", { name: `${exampleFixes[0].title}: To do` })).toBeInTheDocument();
    expect(within(card).queryByRole("checkbox")).toBeNull();
  });
});

// DQ9 (design-quality audit): one accent. Amber is a state colour (UI.md), so the /team chrome (tab, Recents
// and Context file icons, the client avatar) stays neutral.
describe("/team chrome has no amber", () => {
  it("no workspace component uses the amber or warn tones for decoration", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    for (const f of readdirSync("src/components/workspace").filter((n) => n.endsWith(".tsx"))) {
      const text = readFileSync(`src/components/workspace/${f}`, "utf8");
      expect(text, f).not.toMatch(/text-amber|bg-amber/);
    }
  });
});
