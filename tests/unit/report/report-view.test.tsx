import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportView } from "@/components/report/ReportView";
import type { ReportRow } from "@/lib/queries/reports";

const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  id: "r1",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
  status: "sent",
  sent_at: "2026-11-01T15:05:00Z",
  recipients: 1,
  has_pdf: true,
  ...over,
});
const actions = (over = {}) => ({
  save: vi.fn(async () => undefined),
  uploadLogo: vi.fn(async () => undefined),
  sendTest: vi.fn(async () => ({ status: "sent" as const, email: "owner@example.test" })),
  ...over,
});
const props = (over = {}) => ({
  settings: { brand_color: "#1D5FC5", report_recipients: ["owner@example.test"], logoUrl: null },
  reports: [row()],
  previewSrc: "/app/report/preview.pdf",
  actions: actions(),
  ...over,
});

// UI.md 4b "Report" with the lead's strings (COPY.md "Report (lead, 2026-11-05)").
describe("ReportView (/app/report)", () => {
  it("no reports yet: 'Your first report sends on the 1st.' and the preview", () => {
    render(<ReportView {...props({ reports: [] })} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reports");
    expect(screen.getByText("Your first report sends on the 1st.")).toBeInTheDocument();
    expect(screen.getByTitle("Report preview")).toHaveAttribute("src", "/app/report/preview.pdf");
  });

  it("history: Month, Status, Download; the download only when a PDF exists", () => {
    render(
      <ReportView
        {...props({
          reports: [
            row(),
            row({ id: "r2", period_start: "2026-09-01", status: "generated" }),
            row({ id: "r3", period_start: "2026-08-01", status: "queued", has_pdf: false }),
          ],
        })}
      />,
    );
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Month", "Status", "Download"]);
    expect(within(table).getByText("October 2026")).toBeInTheDocument();
    expect(within(table).getByText("Sent")).toBeInTheDocument();
    expect(within(table).getByText("Ready")).toBeInTheDocument();
    expect(within(table).getByText("Queued")).toBeInTheDocument();
    const links = within(table).getAllByRole("link", { name: /Download/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/app/report/r1/download", "/app/report/r2/download"]);
  });

  it("failed send: 'The report didn't send to {email}. Check the address.'", () => {
    render(<ReportView {...props({ reports: [row({ status: "failed" })] })} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The report didn't send to owner@example.test. Check the address.",
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("settings: Brand color + Recipients save, with 'Saved.'; more than 10 or a bad email is refused", async () => {
    const a = actions();
    render(<ReportView {...props({ actions: a })} />);
    const recipients = screen.getByLabelText("Recipients");
    expect(screen.getByText("Up to 10 emails, one per line.")).toBeInTheDocument();
    await userEvent.clear(recipients);
    await userEvent.type(recipients, "nope");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Add up to 10 valid emails, one per line.")).toBeInTheDocument();
    expect(a.save).not.toHaveBeenCalled();
    await userEvent.clear(recipients);
    await userEvent.type(recipients, Array.from({ length: 11 }, (_, i) => `u${i}@example.test`).join("\n"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(a.save).not.toHaveBeenCalled();
    await userEvent.clear(recipients);
    await userEvent.type(recipients, "a@example.test\n\nB@Example.test ");
    const color = screen.getByLabelText("Brand color");
    await userEvent.clear(color);
    await userEvent.type(color, "#0a7f3c");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(a.save).toHaveBeenCalledWith({
      brand_color: "#0A7F3C",
      report_recipients: ["a@example.test", "b@example.test"],
    });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("logo: PNG/JPEG only, at most 512 KB; a good file uploads", async () => {
    const a = actions();
    render(<ReportView {...props({ actions: a })} />);
    const input = screen.getByLabelText("Upload logo");
    await userEvent.upload(input, new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }), { applyAccept: false });
    expect(screen.getByText("Use a PNG or JPEG.")).toBeInTheDocument();
    await userEvent.upload(input, new File([new Uint8Array(512 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(screen.getByText("Logos can be up to 512 KB.")).toBeInTheDocument();
    expect(a.uploadLogo).not.toHaveBeenCalled();
    await userEvent.upload(input, new File([new Uint8Array(10)], "logo.png", { type: "image/png" }));
    expect(a.uploadLogo).toHaveBeenCalledTimes(1);
  });

  it("'Send test to me': 'Test sent to {email}.', or the reused send error", async () => {
    const { unmount } = render(<ReportView {...props()} />);
    await userEvent.click(screen.getByRole("button", { name: "Send test to me" }));
    expect(await screen.findByText("Test sent to owner@example.test.")).toBeInTheDocument();
    unmount();
    render(
      <ReportView {...props({ actions: actions({ sendTest: vi.fn(async () => ({ status: "failed" as const })) }) })} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send test to me" }));
    expect(await screen.findByText("That didn't send. Try again in a minute.")).toBeInTheDocument();
  });

  it("COPY.md has the lead's Report strings", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      "Logo",
      "Upload logo",
      "Brand color",
      "Recipients",
      "Up to 10 emails, one per line.",
      "Save",
      "Saved.",
      "Test sent to {email}.",
      "Use a PNG or JPEG.",
      "Logos can be up to 512 KB.",
      "Add up to 10 valid emails, one per line.",
      "Month",
      "Status",
      "Download",
      "Queued",
      "Building",
      "Ready",
      "Sent",
      "Failed",
      "Report preview",
    ])
      expect(copy.slice(copy.indexOf("## Report (lead, 2026-11-05)"))).toContain(`"${s}"`);
  });
});
