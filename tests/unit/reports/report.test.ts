// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { metric, type MetricAnswer } from "@/lib/metrics";
import { accentColor, contrast } from "@/lib/reports/contrast";
import { REPORT_COPY } from "@/lib/reports/copy";
import { buildReportData, type ReportInput } from "@/lib/reports/data";
import { renderReportPdf } from "@/lib/reports/document";
import { reportEmail, sendReportEmail } from "@/lib/reports/email";
import { isMonthlyWindow, monthLabel, nextReportDate, shortDate } from "@/lib/reports/month";
import { colors } from "@/styles/tokens";
import { readFileSync } from "node:fs";
import { pdfText } from "./pdf-text";

// Example data only.
const BRANDS = [
  { name: "Example Ramen House", kind: "business" as const },
  { name: "Example Noodle Bar", kind: "competitor" as const },
];
let seq = 0;
const ans = (names: string[], status: MetricAnswer["status"] = "ok"): MetricAnswer => ({
  id: `a${++seq}`,
  question_id: "q1",
  question_text_used: "best ramen in Irvine",
  engine: "chatgpt",
  run_index: 1,
  status,
  mentioned: status === "ok" ? names.includes("Example Ramen House") : null,
  first_position: null,
  brands: status === "ok" ? BRANDS.map((b) => ({ ...b, mentioned: names.includes(b.name), position: null })) : null,
  location_used: "US",
  location_supported: "fallback_country",
  checked_at: "2026-10-27T13:40:00.000Z",
});
const answers = [ans(["Example Ramen House"]), ans(["Example Noodle Bar"]), ans([], "failed")];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const input = (p: Partial<ReportInput> = {}): ReportInput => ({
  business: { name: "Example Ramen House", brand_color: "#1a5fbf" },
  logo: null,
  periodStart: "2026-10-01",
  runs: [
    {
      id: "r2",
      status: "complete",
      started_at: "2026-10-27T13:00:00Z",
      finished_at: "2026-10-27T13:40:00Z",
      visibility: metric(1, 2),
    },
    {
      id: "r1",
      status: "partial",
      started_at: "2026-10-20T13:00:00Z",
      finished_at: "2026-10-20T13:40:00Z",
      visibility: metric(0, 2),
    },
  ],
  last: {
    answers,
    citations: [
      {
        answer_id: answers[0].id,
        url: "https://example-reviews.test/r",
        domain: "example-reviews.test",
        position: 1,
        category: "review_directory",
      },
    ],
    brands: BRANDS,
  },
  previous: {
    id: "r0",
    status: "complete",
    started_at: "2026-09-29T13:00:00Z",
    finished_at: "2026-09-29T13:40:00Z",
    visibility: metric(0, 4),
  },
  fixes: [
    {
      title: "Crawlable HTML menu on your own site",
      detail: "Your menu is a PDF; there's no menu page with the dishes as text.",
    },
  ],
  ...p,
});

describe("isMonthlyWindow (the 1st, 07:xx America/Los_Angeles)", () => {
  it.each([
    ["2026-11-01T15:00:00Z", true], // PST: 07:00 LA
    ["2026-11-01T14:00:00Z", false], // PST: 06:00 LA
    ["2026-10-01T14:00:00Z", true], // PDT
    ["2026-10-01T15:00:00Z", false],
    ["2026-03-01T15:00:00Z", true], // PST before the Mar 8 switch
    ["2026-04-01T14:00:00Z", true], // PDT after it
    ["2026-11-02T15:00:00Z", false], // the 2nd
    ["2026-11-01T07:00:00Z", false], // Oct 31 23:00 LA
  ])("%s → %s", (iso, want) => expect(isMonthlyWindow(new Date(iso))).toBe(want));

  it("exactly one of the two fires (14:00, 15:00 UTC on the 1st) matches, every month of 2026", () => {
    for (let m = 1; m <= 12; m++) {
      const day = `2026-${String(m).padStart(2, "0")}-01`;
      expect(
        ["14", "15"].filter((h) => isMonthlyWindow(new Date(`${day}T${h}:00:00Z`))),
        day,
      ).toHaveLength(1);
    }
  });

  it("labels the month", () => expect(monthLabel("2026-10-01")).toBe("October 2026"));

  // X10: the Reports status line names the next send, the 1st at 07:xx LA (America/Los_Angeles).
  it.each([
    ["2026-11-06T13:00:00Z", "2026-12-01"], // mid-month
    ["2026-12-01T14:30:00Z", "2026-12-01"], // the 1st, 06:30 LA: today's send hasn't gone yet
    ["2026-12-01T15:30:00Z", "2026-12-01"], // 07:30 LA: sending now
    ["2026-12-01T16:00:00Z", "2027-01-01"], // 08:00 LA: sent, so next month (and next year)
    ["2026-11-01T06:00:00Z", "2026-11-01"], // Oct 31 23:00 LA
  ])("next report after %s is %s", (iso, want) => expect(nextReportDate(new Date(iso))).toBe(want));

  it("short date for the status line", () => expect(shortDate("2026-12-01")).toBe("Dec 1"));
});

describe("accent color", () => {
  it("keeps a brand color with AA contrast on white, else falls back to ink", () => {
    expect(accentColor("#1A5FBF")).toBe("#1a5fbf");
    expect(accentColor("#F7D354")).toBe(colors.ink); // yellow fails AA
    expect(accentColor("#ffffff")).toBe(colors.ink);
    for (const bad of [null, "", "blue", "#123", "#12345g"]) expect(accentColor(bad)).toBe(colors.ink);
    expect(contrast(colors.ink, "#ffffff")).toBeGreaterThan(4.5);
  });
});

describe("buildReportData", () => {
  it("stored data only: n on every %, change vs the previous month's last run, top lists", () => {
    const d = buildReportData(input());
    expect(d.visibility).toEqual({
      text: "50% (named in 1 of 2 answers)",
      named: "named in 1 of 2 answers",
      change: "+50 pts",
    });
    // A tie: the business comes first (computeMetrics' order).
    expect(d.competitors).toEqual([
      { name: "Example Ramen House", you: true, text: "50% (named in 1 of 2 answers)" },
      { name: "Example Noodle Bar", you: false, text: "50% (named in 1 of 2 answers)" },
    ]);
    expect(d.sources).toEqual([{ domain: "example-reviews.test", category: "Review sites", links: 1 }]);
    expect(d.weekly.map((w) => [w.date, w.partial])).toEqual([
      ["Oct 20", true],
      ["Oct 27", false],
    ]);
    expect(d.answers).toBe(2);
    expect(d.accent).toBe("#1a5fbf");
  });

  it("a month with no run: no numbers invented", () => {
    const d = buildReportData(input({ runs: [], last: null, previous: null }));
    expect(d.visibility).toBeNull();
    expect(d.engines).toEqual([]);
    expect(d.answers).toBe(0);
  });

  it("forbidden fields never reach the data, even if inputs carry them", () => {
    const leaky = input();
    const secret = {
      why_note: "WHY-SECRET",
      raw: "RAW-SECRET",
      cost_usd: 9.99,
      email: "owner@example.test",
      token: "TOKEN-SECRET",
    };
    Object.assign(leaky.business, secret);
    Object.assign(leaky.fixes[0], secret);
    Object.assign(leaky.last!.answers[0], secret);
    expect(JSON.stringify(buildReportData(leaky))).not.toMatch(/SECRET|9\.99|owner@example\.test/);
  });
});

describe("white-label PDF and email", () => {
  it("the rendered PDF has the business and the lead's headings, and no product name or credit", async () => {
    const data = buildReportData(input({ logo: { bytes: PNG, type: "image/png" } }));
    const pdf = await renderReportPdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdfText(pdf);
    // Control: the extraction finds what the page draws.
    expect(text).toContain("Example Ramen House");
    for (const h of Object.values(REPORT_COPY.headings)) expect(text, h).toContain(h);
    expect(text).toContain("API-measured, directional");
    expect(text).not.toMatch(/rank1|rank 1|powered by|jelly/i);
  });

  it("the PDF code and copy have no product name either", () => {
    for (const f of ["document.tsx", "copy.ts", "email.ts", "data.ts"]) {
      const src = readFileSync(`src/lib/reports/${f}`, "utf8").replace(/\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/rank1|powered by|jelly/i);
    }
  });

  it("the email: From = the business name at REPORT_FROM_EMAIL, the lead's subject and body, the PDF attached, no product name", async () => {
    const data = buildReportData(input());
    const email = reportEmail(data, {
      fromAddress: "hello@example.test",
      to: ["owner@example.test"],
      pdf: new Uint8Array([37, 80, 68, 70]),
      filename: "report-2026-10.pdf",
    });
    expect(email).toEqual({
      from: "Example Ramen House <hello@example.test>",
      to: ["owner@example.test"],
      subject: "Example Ramen House AI visibility report, October 2026",
      text: "Your October 2026 AI visibility report is attached.\n\nAPI-measured, directional. Based on 2 AI answers.",
      attachments: [{ filename: "report-2026-10.pdf", content: "JVBERg==" }],
    });
    expect(JSON.stringify(email)).not.toMatch(/rank1|powered by|jelly/i);
  });

  it("a business name can't break the From header", () => {
    const data = { ...buildReportData(input()), businessName: 'Example "Bad" <x@evil.test>\nBcc: y' };
    expect(
      reportEmail(data, { fromAddress: "hello@example.test", to: [], pdf: new Uint8Array(), filename: "r.pdf" }).from,
    ).toBe("Example Bad x@evil.test Bcc: y <hello@example.test>");
  });

  it("sends via Resend with the report id as the idempotency key; false without a key or on a non-2xx", async () => {
    const email = reportEmail(buildReportData(input()), {
      fromAddress: "hello@example.test",
      to: ["owner@example.test"],
      pdf: new Uint8Array([1]),
      filename: "r.pdf",
    });
    const f = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    expect(await sendReportEmail(email, "report-1", { fetch: f, apiKey: "re_test" })).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>)["idempotency-key"]).toBe("report-1");
    expect(JSON.parse(String(init?.body)).attachments[0].filename).toBe("r.pdf");
    expect(await sendReportEmail(email, "report-1", { fetch: f, apiKey: "" })).toBe(false);
    expect(
      await sendReportEmail(email, "report-1", {
        fetch: vi.fn<typeof fetch>(async () => new Response("", { status: 422 })),
        apiKey: "re_test",
      }),
    ).toBe(false);
  });
});
