import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { exampleLatest, exampleRuns } from "@/components/app/example-data";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { exampleDone, exampleFixes, exampleTidyUps } from "@/components/fixes/example-data";

const NOW = new Date("2026-11-05T12:00:00Z");
const business = { name: "Example Ramen House" };
const fixes = { ranked: exampleFixes, tidyUps: exampleTidyUps, done: exampleDone, unchecked: [], noDomain: false };
const notice = <aside aria-label="Connect card">G3</aside>;
const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const many = Array.from({ length: 8 }, (_, i) => ({ ...exampleRuns[i % exampleRuns.length], id: `run-${i}` }));

// X3 (UX plan PR 18): a DFY client first wants to know what the team did. Slot 2 lists the fixes in
// progress and done, with who and when; the G3/C-b card follows; History shows the last 4 checks.
describe("/client: what the team did, first", () => {
  it("slot 2 lists in progress, then done, with who and when, before the connect card and the chart", () => {
    render(
      <ClientDashboard
        business={business}
        latest={exampleLatest}
        runs={exampleRuns}
        fixes={fixes}
        now={NOW}
        notice={notice}
      />,
    );
    const did = screen.getByRole("region", { name: "What the team did" });
    const items = within(did).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(exampleFixes[2].title);
    expect(items[0]).toHaveTextContent("In progress · Rank1 team · Nov 5");
    expect(items.at(-1)).toHaveTextContent(exampleDone[0].title);
    expect(items.at(-1)).toHaveTextContent("Done Nov 4 · Example Owner");
    expect(within(did).queryByRole("checkbox")).toBeNull();
    expect(within(did).queryByRole("button")).toBeNull();
    const hero = screen.getAllByText("named in 80 of 240 answers")[0];
    expect(after(hero, did)).toBe(true);
    expect(after(did, screen.getByRole("complementary", { name: "Connect card" }))).toBe(true);
    expect(after(did, screen.getByRole("heading", { name: "Visibility" }))).toBe(true);
  });

  it("no in-progress or done fix (or fixes hidden): no section at all", () => {
    render(<ClientDashboard business={business} latest={exampleLatest} runs={exampleRuns} fixes={null} now={NOW} />);
    expect(screen.queryByRole("region", { name: "What the team did" })).toBeNull();
  });

  it("History shows the last 4 checks only", () => {
    render(<ClientDashboard business={business} latest={exampleLatest} runs={many} fixes={null} now={NOW} />);
    const table = screen.getByRole("table", { name: "History" });
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(4);
  });
});
