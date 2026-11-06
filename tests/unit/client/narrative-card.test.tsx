import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { exampleBusiness, exampleLatest, exampleRuns } from "@/components/app/example-data";
import { NarrativeDashboard } from "@/components/narrative/NarrativeDashboard";
import {
  exampleNarrative,
  exampleNarrativeNoClash,
  exampleNarrativeNoWords,
} from "@/components/narrative/example-data";
import { narrativeCopy as c } from "@/components/narrative/copy";

// Q4 (lead 2026-11-06): the /client narrative card, read-only and only for a clash (the /app Dashboard's rule).
// Nothing for no clash, too few answers or no words; no edit link (the team sets the words in /team).
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("NarrativeDashboard readOnly", () => {
  it("a clash: the card, the count line and the snippet, with no links", () => {
    render(<NarrativeDashboard view={exampleNarrative} readOnly />);
    const card = screen.getByRole("region", { name: c.title });
    expect(card).toHaveTextContent(c.clash(6, 48, ["cheap"]));
    expect(card.querySelector("mark")).toHaveTextContent("cheap");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each([
    ["no clash", exampleNarrativeNoClash],
    ["too few answers", { ...exampleNarrative, result: { ...exampleNarrative.result!, tooFew: true } }],
    ["no words (no quiet line either)", exampleNarrativeNoWords],
    ["no finished run", { ...exampleNarrative, checkedAt: null, result: null }],
  ])("%s: nothing", (_, view) => {
    const { container } = render(<NarrativeDashboard view={view} readOnly />);
    expect(container).toBeEmptyDOMElement();
  });

  it("the /app card keeps its Edit words link", () => {
    render(<NarrativeDashboard view={exampleNarrative} />);
    expect(screen.getByRole("link", { name: c.edit })).toHaveAttribute("href", "/app/settings/narrative");
  });
});

describe("ClientDashboard narrative slot", () => {
  it("after the connect notice, before Visibility", () => {
    render(
      <ClientDashboard
        business={{ name: exampleBusiness.name }}
        latest={exampleLatest}
        runs={exampleRuns}
        fixes={null}
        now={new Date("2026-11-05T12:00:00Z")}
        notice={<section aria-label="Notice">n</section>}
        narrative={<section aria-label="Narrative">g4</section>}
      />,
    );
    const slot = screen.getByRole("region", { name: "Narrative" });
    expect(before(screen.getByRole("region", { name: "Notice" }), slot)).toBe(true);
    expect(before(slot, screen.getByRole("heading", { name: "Visibility" }))).toBe(true);
  });
});

// The loader reads the words with the client's own session (RLS: a dfy_client reads, never sets), and only
// with ENABLE_NARRATIVE (loadDashboardNarrative returns null otherwise).
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ db: true }) }));
const biz = vi.hoisted(() => ({
  list: [{ id: "b1", name: "Example Ramen House", fix_list_visible: false, domain: null }],
}));
vi.mock("@/lib/queries/team", () => ({ listDfyBusinesses: async () => biz.list }));
vi.mock("@/lib/queries/shell", () => ({ listRunSummaries: async () => [] }));
vi.mock("@/components/audit/load", () => ({ loadPaidRun: async () => null }));
vi.mock("@/components/connections/load", () => ({ loadConnectCard: async () => null }));
const nar = vi.hoisted(() => ({ loadDashboardNarrative: vi.fn(async () => null as unknown) }));
vi.mock("@/components/narrative/load", () => nar);

describe("loadClient: narrative", () => {
  it("the client's business words, from loadDashboardNarrative", async () => {
    const { loadClient } = await import("@/app/client/load");
    nar.loadDashboardNarrative.mockResolvedValueOnce(exampleNarrative);
    expect((await loadClient()).narrative).toEqual(exampleNarrative);
    expect(nar.loadDashboardNarrative).toHaveBeenCalledWith({ db: true }, "b1");
  });

  it("no business: no narrative", async () => {
    const { loadClient } = await import("@/app/client/load");
    biz.list = [];
    expect((await loadClient()).narrative).toBeNull();
    biz.list = [{ id: "b1", name: "Example Ramen House", fix_list_visible: false, domain: null }];
  });
});
