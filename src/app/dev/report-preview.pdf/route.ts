import { NextResponse } from "next/server";
import { exampleLatest, exampleRuns } from "@/components/app/example-data";
import { exampleFixes } from "@/components/fixes/example-data";
import type { MetricCitation } from "@/lib/metrics";
import { buildReportData } from "@/lib/reports/data";
import { renderReportPdf } from "@/lib/reports/document";

// The /dev/app report gallery's preview: data-pipeline's real PDF on Example data. 404 in production.
export async function GET() {
  if (process.env.VERCEL_ENV === "production") return new NextResponse(null, { status: 404 });
  const october = exampleRuns.slice(0, 4).map((r, i) => ({
    ...r,
    started_at: `2026-10-${String(27 - 7 * i).padStart(2, "0")}T14:00:00Z`,
    finished_at: `2026-10-${String(27 - 7 * i).padStart(2, "0")}T14:40:00Z`,
  }));
  const data = buildReportData({
    business: { name: "Example Ramen House", brand_color: "#1D5FC5" },
    logo: null,
    periodStart: "2026-10-01",
    runs: october,
    last: {
      answers: exampleLatest.results.answers,
      citations: exampleLatest.results.citations as MetricCitation[],
      brands: exampleLatest.results.brands,
    },
    previous: { ...exampleRuns[4], finished_at: "2026-09-29T14:40:00Z" },
    fixes: exampleFixes.map(({ title, detail }) => ({ title, detail })),
  });
  const pdf = await renderReportPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
  });
}
