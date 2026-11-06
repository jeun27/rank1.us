// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pdfText } from "./pdf-text";

// Review of #77: the drain reads with the service client, so the DFY "fix list hidden" rule must be
// applied in the report itself. DFY + fix_list_visible false → no "What to fix next" section at all.
const q = vi.hoisted(() => ({ listRunSummaries: vi.fn(), listFixes: vi.fn(), getRunResults: vi.fn() }));
vi.mock("@/lib/queries/shell", () => ({ listRunSummaries: q.listRunSummaries }));
vi.mock("@/lib/queries/fixes", () => ({ listFixes: q.listFixes }));
vi.mock("@/lib/queries/results", () => ({ getRunResults: q.getRunResults }));

const { processReportsWith } = await import("@/lib/reports/service");

const FIX = { title: "Add your opening hours to Google", detail: "Example detail for the hours fix." };
const HEADING = "What to fix next";
type Business = { service: "self_serve" | "dfy"; fix_list_visible: boolean };

function serviceDb(b: Business, uploaded: Uint8Array[]) {
  let claimed = false;
  return {
    rpc: async (name: string) => {
      if (name !== "claim_reports") return { data: true, error: null };
      if (claimed) return { data: [], error: null };
      claimed = true;
      return {
        data: [{ report_id: "rep-1", business_id: "biz-1", period_start: "2026-10-01", period_end: "2026-10-31" }],
        error: null,
      };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              name: "Example Ramen House",
              brand_color: null,
              logo_path: null,
              report_recipients: ["owner@example.com"],
              ...b,
            },
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: async (_path: string, pdf: Uint8Array) => (uploaded.push(pdf), { error: null }),
      }),
    },
  } as never;
}

// Only Resend is faked: react-pdf's layout engine loads its wasm through the real fetch.
const realFetch = globalThis.fetch;
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_example_only");
  vi.stubEnv("REPORT_FROM_EMAIL", "hello@example.com");
  vi.stubGlobal(
    "fetch",
    fetchMock
      .mockReset()
      .mockImplementation(async (url: string, init?: RequestInit) =>
        url === "https://api.resend.com/emails" ? new Response("{}", { status: 200 }) : realFetch(url, init),
      ),
  );
  q.listRunSummaries.mockReset().mockResolvedValue([]);
  q.listFixes.mockReset().mockResolvedValue({ ranked: [{ ...FIX }], tidyUps: [], unchecked: [], lastRunId: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function run(b: Business) {
  const uploaded: Uint8Array[] = [];
  const summary = await processReportsWith(serviceDb(b, uploaded), () => 200_000);
  expect(summary).toEqual({ sent: 1, generated: 0, retry: 0 });
  const call = fetchMock.mock.calls.find((c) => c[0] === "https://api.resend.com/emails")!;
  const email = JSON.parse(call[1].body);
  return { pdf: pdfText(uploaded[0]), email: `${email.subject}\n${email.text}` };
}

describe("fix list in the monthly report", () => {
  it("DFY with the fix list hidden: no fixes heading or text in the PDF or email", async () => {
    const { pdf, email } = await run({ service: "dfy", fix_list_visible: false });
    expect(pdf).toContain("Example Ramen House"); // control: the PDF text is readable
    for (const s of [HEADING, FIX.title, FIX.detail]) {
      expect(pdf).not.toContain(s);
      expect(email).not.toContain(s);
    }
    expect(q.listFixes).not.toHaveBeenCalled();
  });

  it("DFY with the fix list visible: the section is shown", async () => {
    const { pdf } = await run({ service: "dfy", fix_list_visible: true });
    expect(pdf).toContain(HEADING);
    expect(pdf).toContain(FIX.title);
  });

  it("self-serve: always shown, whatever fix_list_visible says", async () => {
    const { pdf } = await run({ service: "self_serve", fix_list_visible: false });
    expect(pdf).toContain(HEADING);
    expect(pdf).toContain(FIX.title);
  });
});
