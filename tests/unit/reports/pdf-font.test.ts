// @vitest-environment node
import { describe, expect, it } from "vitest";
import { metric, type MetricAnswer } from "@/lib/metrics";
import { buildReportData } from "@/lib/reports/data";
import { renderReportPdf } from "@/lib/reports/document";
import { pdfText } from "./pdf-text";

// #165 review: Helvetica (the PDF default) has no U+2212, so "−3 pts" printed as "3 pts" and read like
// a gain. The report embeds Inter (F1b's files), like the app: the minus has a glyph and survives.
const BRANDS = [
  { name: "Example Ramen House", kind: "business" as const },
  { name: "Example Noodle Bar", kind: "competitor" as const },
];
const ans = (id: string, named: boolean): MetricAnswer => ({
  id,
  question_id: "q1",
  question_text_used: "best ramen in Irvine",
  engine: "chatgpt",
  run_index: 1,
  status: "ok",
  mentioned: named,
  first_position: null,
  brands: BRANDS.map((b) => ({ ...b, mentioned: b.kind === "business" ? named : !named, position: null })),
  location_used: "US",
  location_supported: "fallback_country",
  checked_at: "2026-10-27T13:40:00.000Z",
});
const input = (previous: number) => ({
  business: { name: "Example Ramen House", brand_color: "#1a5fbf" },
  logo: null,
  periodStart: "2026-10-01",
  runs: [
    {
      id: "r2",
      status: "complete" as const,
      started_at: "2026-10-27T13:00:00Z",
      finished_at: "2026-10-27T13:40:00Z",
      visibility: metric(1, 2),
    },
  ],
  last: { answers: [ans("a1", true), ans("a2", false)], citations: [], brands: BRANDS },
  previous: {
    id: "r0",
    status: "complete" as const,
    started_at: "2026-09-29T13:00:00Z",
    finished_at: "2026-09-29T13:40:00Z",
    visibility: metric(previous, 100),
  },
  fixes: [],
});

describe("report PDF font", () => {
  it("a drop prints with its minus sign (−3 pts)", async () => {
    const data = buildReportData(input(53));
    expect(data.visibility?.change).toBe("−3 pts");
    const text = pdfText(await renderReportPdf(data));
    expect(text).toContain("−3 pts");
    expect(text).toContain("Example Ramen House");
  });

  it("embeds Inter and never falls back to Helvetica", async () => {
    const raw = Buffer.from(await renderReportPdf(buildReportData(input(53)))).toString("latin1");
    expect(raw).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter/);
    expect(raw).not.toMatch(/Helvetica/);
  });
});
