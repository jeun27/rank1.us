import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import { exampleBusiness, exampleFixes, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { seriesFromSummaries } from "@/lib/metrics";

// UX plan §B (lead 08:06): the C-b card sits after the hero (the next-fix card, PR6, goes between them),
// or first when there's no run yet. /client: the slot below the hero.
const NOW = new Date("2026-11-05T14:30:00Z");
const notice = <section aria-label="Connect slot">slot</section>;
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
// The hero's line is the first "named in n of d answers" on the page.
const hero = () => screen.getAllByText(/named in \d+ of \d+ answers/)[0];

describe("the C-b card slot", () => {
  it("/app: after the hero, before the chart", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={exampleLatest}
        series={seriesFromSummaries(exampleRuns)}
        fixes={exampleFixes}
        now={NOW}
        notice={notice}
      />,
    );
    const slot = screen.getByRole("region", { name: "Connect slot" });
    expect(before(hero(), slot)).toBe(true);
    expect(before(slot, screen.getByRole("heading", { name: "Visibility" }))).toBe(true);
  });

  it("/app with no run yet: the card comes first", () => {
    render(
      <Dashboard
        business={exampleBusiness}
        latest={null}
        series={{ points: [], visible: false }}
        fixes={[]}
        now={NOW}
        notice={notice}
      />,
    );
    expect(screen.getByRole("region", { name: "Connect slot" })).toBeInTheDocument();
  });

  it("/client: below the hero", () => {
    render(
      <ClientDashboard
        business={{ name: exampleBusiness.name }}
        latest={exampleLatest}
        runs={exampleRuns}
        fixes={null}
        now={NOW}
        notice={notice}
      />,
    );
    expect(before(hero(), screen.getByRole("region", { name: "Connect slot" }))).toBe(true);
  });
});
