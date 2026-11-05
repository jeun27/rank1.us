// Report strings, exactly as docs/COPY.md "Report (lead, 2026-11-05)". White-label: no product name here.
export const REPORT_COPY = {
  subject: "{Business} AI visibility report, {Month YYYY}",
  body: "Your {Month YYYY} AI visibility report is attached.\n\nAPI-measured, directional. Based on {n} AI answers.",
  headings: {
    visibility: "AI visibility",
    engines: "By engine",
    competitors: "Competitors",
    sources: "Top sources",
    fixes: "What to fix next",
    weekly: "Weekly checks",
  },
  label: "API-measured, directional",
} as const;

export const fill = (t: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((s, [k, x]) => s.split(`{${k}}`).join(String(x)), t);
