import type { MetricAnswer, MetricCitation } from "./compute";

export const CSV_COLUMNS = [
  "question",
  "engine",
  "run_index",
  "status",
  "mentioned",
  "first_position",
  "location_used",
  "location_supported",
  "checked_at",
  "cited_domains",
] as const;

// A cell a spreadsheet could read as a formula gets a leading ' (OWASP CSV injection).
const guard = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

// RFC 4180: quote cells with a comma, quote or line break, and double inner quotes.
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = guard(String(v));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per answer, in the given order. cited_domains = unique domains in citation order.
export function toCsv(answers: MetricAnswer[], citations: MetricCitation[]): string {
  const cites = new Map<string, MetricCitation[]>();
  for (const c of citations) cites.set(c.answer_id, [...(cites.get(c.answer_id) ?? []), c]);
  const rows = answers.map((a) => {
    const domains = [...new Set((cites.get(a.id) ?? []).sort((x, y) => x.position - y.position).map((c) => c.domain))];
    return [
      a.question_text_used,
      a.engine,
      a.run_index,
      a.status,
      a.mentioned,
      a.first_position,
      a.location_used,
      a.location_supported,
      a.checked_at,
      domains.join("; "),
    ];
  });
  return [CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
