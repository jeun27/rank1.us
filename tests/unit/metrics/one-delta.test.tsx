import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exampleFailedRun, exampleRuns } from "@/components/app/example-data";
import { HistoryTable } from "@/components/app/HistoryView";
import { Workspace } from "@/components/workspace/Workspace";
import { buildWorkspace } from "@/lib/queries/workspace";
import { pointsChange } from "@/lib/workspace/context";
import { exampleWorkspaceRows } from "@/app/team/example-data";

vi.mock("next/navigation", () => ({ usePathname: () => "/team" }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.unstubAllGlobals());

const metric = (n: number, d: number) => ({ value: n / d, numerator: n, denominator: d });
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );

// Lead (after #126): one points formatter (signedPts, a real minus) and one tone rule (deltaTone) everywhere.
describe("one delta format", () => {
  it("no other file builds a '… pts' string", () => {
    const own = files("src").filter((f) => f !== join("src", "lib", "metrics", "delta.ts"));
    const hits = own.filter((f) => /\} pts`/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("context and reports use the real minus", () => {
    expect(pointsChange(metric(58, 200), metric(57, 100))).toBe("−28 pts");
  });

  it("History shows a drop with the real minus", () => {
    render(<HistoryTable runs={[exampleFailedRun, ...exampleRuns]} />);
    expect(screen.getAllByText(/^−\d+ pts$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^-\d+ pts$/)).toBeNull();
  });

  it("the /team Dashboard delta is a mono state badge, not info blue", () => {
    const view = buildWorkspace(exampleWorkspaceRows());
    render(<Workspace view={view} team={null} />);
    const tag = screen.getAllByText(/^[+−]?\d+ pts$/).find((e) => e.classList.contains("rounded-tag"))!;
    expect(tag).toHaveClass("font-mono");
    expect(tag).not.toHaveClass("text-jellyDeep");
  });
});
