import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditImage } from "@/components/audit/AuditImage";
import { exampleMetrics, exampleRun } from "@/components/audit/example-data";
import { csvResponse } from "@/components/audit/respond";
import { CSV_COLUMNS } from "@/lib/metrics";

const loaded = { results: exampleRun("complete"), metrics: exampleMetrics };

describe("exports", () => {
  it("an unknown run or token is a 404, never cached", () => {
    const res = csvResponse(null);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("CSV: one row per answer under the header, as an attachment with no referrer", async () => {
    const res = csvResponse(loaded);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="rank1-audit-example-ramen-house-2026-11-05.csv"',
    );
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const lines = (await res.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(loaded.results.answers.length + 1);
  });

  it("PNG: hero %, n, the label and per-engine rows; the credit only on the free audit", () => {
    const paid = renderToStaticMarkup(<AuditImage {...loaded} free={false} />);
    expect(paid).toContain("33%");
    expect(paid).toContain("named in 80 of 240 answers");
    expect(paid).toContain("API-measured, directional");
    expect(paid).toContain("Google AI Overview");
    expect(paid).toContain("Example Noodle Bar");
    expect(paid).not.toContain("Powered by Rank1");
    const free = renderToStaticMarkup(<AuditImage {...loaded} free />);
    expect(free).toContain("Powered by Rank1");
  });
});
