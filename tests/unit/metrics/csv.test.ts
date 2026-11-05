import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, csvCell, toCsv, type MetricAnswer } from "@/lib/metrics";
import { parseCsv } from "../../fixtures/irvine_restaurants";

const a = (p: Partial<MetricAnswer>): MetricAnswer => ({
  id: "a1",
  question_id: "q1",
  question_text_used: "best ramen in Irvine",
  engine: "perplexity",
  run_index: 1,
  status: "ok",
  mentioned: true,
  first_position: 1,
  brands: null,
  location_used: "Irvine, California, United States",
  location_supported: "exact",
  checked_at: "2026-11-05T12:00:00.000Z",
  ...p,
});

describe("toCsv", () => {
  it("one row per answer with the fixed columns and RFC 4180 CRLF", () => {
    const csv = toCsv(
      [
        a({}),
        a({ id: "a2", status: "failed", mentioned: null, first_position: null, engine: "chatgpt", run_index: 3 }),
      ],
      [
        { answer_id: "a1", url: "https://example-b.test/1", domain: "example-b.test", position: 2, category: "other" },
        { answer_id: "a1", url: "https://example-a.test/1", domain: "example-a.test", position: 1, category: "other" },
        { answer_id: "a1", url: "https://example-a.test/2", domain: "example-a.test", position: 3, category: "other" },
      ],
    );
    expect(csv.endsWith("\r\n")).toBe(true);
    const rows = parseCsv(csv.trimEnd());
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows[1]).toEqual([
      "best ramen in Irvine",
      "perplexity",
      "1",
      "ok",
      "true",
      "1",
      "Irvine, California, United States",
      "exact",
      "2026-11-05T12:00:00.000Z",
      "example-a.test; example-b.test",
    ]);
    expect(rows[2]).toEqual([
      "best ramen in Irvine",
      "chatgpt",
      "3",
      "failed",
      "",
      "",
      "Irvine, California, United States",
      "exact",
      "2026-11-05T12:00:00.000Z",
      "",
    ]);
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('say "hi", then\nleave')).toBe('"say ""hi"", then\nleave"');
    const rows = parseCsv(toCsv([a({ question_text_used: 'ramen, "best"\nIrvine' })], []).trimEnd());
    expect(rows[1][0]).toBe('ramen, "best"\nIrvine');
  });

  it.each(['=HYPERLINK("x")', "+1+1", "-2", "@SUM(A1)", "\tx", "\rx"])(
    "guards formula-looking cell %j with a leading '",
    (v) => {
      const cell = csvCell(v);
      expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
      const rows = parseCsv(toCsv([a({ question_text_used: v })], []).trimEnd());
      expect(rows[1][0]).toBe(`'${v}`);
    },
  );

  it("leaves safe cells alone and empties nulls", () => {
    expect(csvCell("best ramen")).toBe("best ramen");
    expect(csvCell(null)).toBe("");
    expect(csvCell(false)).toBe("false");
    expect(csvCell(0)).toBe("0");
  });
});
