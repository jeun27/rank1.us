import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditView } from "@/components/audit/AuditView";
import { auditCopy } from "@/components/audit/copy";
import { exampleMetrics, exampleRun } from "@/components/audit/example-data";
import { ENGINE_IDS } from "@/lib/engines/types";

const now = new Date("2026-11-05T14:30:00Z");
// Lead follow-up (item 8): the count comes from the engine list, so the approved sentence stays true.
const SENTENCE = `Rank1 checks these ${ENGINE_IDS.length} AI engines every week and shows you what to fix next.`;
const view = (free: boolean) =>
  render(
    <AuditView
      results={exampleRun("complete", free ? { kind: "free_audit" } : {})}
      metrics={exampleMetrics}
      free={free}
      exportBase={free ? "/audit/tok" : "/app/runs/example-run"}
      now={now}
    />,
  );
const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

// X4 (UX plan PR 20): ask at the peak moment, right after the competitor gap, with one sentence and the
// one primary; the rest of the detail follows. A logo bar takes the visitor home.
describe("free audit: ask at the competitor gap", () => {
  it("the CTA sentence counts the engine list instead of a hard-coded 4", () => {
    expect(ENGINE_IDS).toHaveLength(4);
    expect(auditCopy.ctaLead(ENGINE_IDS.length)).toBe(
      "Rank1 checks these 4 AI engines every week and shows you what to fix next.",
    );
    expect(auditCopy.ctaLead(5)).toBe("Rank1 checks these 5 AI engines every week and shows you what to fix next.");
  });

  it("orders hero → leaderboard → CTA panel → engines → downloads, with one primary", () => {
    view(true);
    const leaderboard = screen.getByRole("table", { name: "Competitors" });
    const cta = screen.getByRole("region", { name: SENTENCE });
    const engines = screen.getByRole("table", { name: "Engine" });
    const csv = screen.getByRole("link", { name: "Download CSV" });
    expect(after(leaderboard, cta)).toBe(true);
    expect(after(cta, engines)).toBe(true);
    expect(after(engines, csv)).toBe(true);
    expect(within(cta).getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute(
      "href",
      "/signin?next=%2Fapp%2Fbilling",
    );
    expect(screen.getAllByRole("link", { name: "Start for $99/mo" })).toHaveLength(1);
  });

  it("has a logo bar linking home", () => {
    view(true);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Rank1" })).toHaveAttribute("href", "/");
  });

  it("the paid result has no CTA panel and no extra logo bar", () => {
    view(false);
    expect(screen.queryByText(SENTENCE)).toBeNull();
    expect(screen.queryByRole("link", { name: "Start for $99/mo" })).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});
