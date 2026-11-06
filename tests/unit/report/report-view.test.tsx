import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  nextReport: "2026-12-01",
  actions: actions(),
  ...over,
});

// X10: Preview and Branding are folded (<details>); the tests open them like a user does.
const open = (name: "Report preview" | "Branding") =>
  userEvent.click(screen.getByText(name, { selector: "summary, summary *" }));

// UI.md 4b "Report" with the lead's strings (COPY.md "Report (lead, 2026-11-05)").
describe("ReportView (/app/report)", () => {
  it("no reports yet: 'Your first report sends on the 1st.' and the preview (once opened)", async () => {
    render(<ReportView {...props({ reports: [] })} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reports");
    expect(screen.getByText("Your first report sends on the 1st.")).toBeInTheDocument();
    // X10: the PDF renders on demand, so the iframe only mounts when Preview opens.
    expect(screen.queryByTitle("Report preview")).toBeNull();
    await open("Report preview");
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
    await open("Branding");
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
    // A native color picker: it only yields #rrggbb, so there is no invalid color to report.
    const color = screen.getByLabelText("Brand color");
    expect(color).toHaveAttribute("type", "color");
    fireEvent.change(color, { target: { value: "#0a7f3c" } });
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
    await open("Branding");
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
    await open("Branding");
    await userEvent.click(screen.getByRole("button", { name: "Send test to me" }));
    expect(await screen.findByText("Test sent to owner@example.test.")).toBeInTheDocument();
    unmount();
    render(
      <ReportView {...props({ actions: actions({ sendTest: vi.fn(async () => ({ status: "failed" as const })) }) })} />,
    );
    await open("Branding");
    await userEvent.click(screen.getByRole("button", { name: "Send test to me" }));
    expect(await screen.findByText("That didn't send. Try again in a minute.")).toBeInTheDocument();
  });

  // UI.md 4b Report partial: GA4 isn't connected, so the GA4 section is hidden; the link shows only when
  // the Connections hub exists (ENABLE_CONNECTIONS), never a dead link (QA #89 F1).
  it("GA4 not connected: no GA4 section; 'Connect GA4' only when a hub link is given", () => {
    const { unmount } = render(<ReportView {...props({ connectGa4Href: "/app/settings/connections" })} />);
    expect(screen.getByRole("link", { name: "Connect GA4" })).toHaveAttribute("href", "/app/settings/connections");
    expect(screen.queryByRole("heading", { name: /GA4|traffic/i })).toBeNull();
    unmount();
    render(<ReportView {...props()} />);
    expect(screen.queryByRole("link", { name: "Connect GA4" })).toBeNull();
  });

  // X10 + X28 (UX plan PR 21): the status line first, then history, then Preview and Branding folded.
  describe("status first, settings folded (X10, X28)", () => {
    it("the status line names the next send and the saved recipients (n), and leads the page", () => {
      const { container, unmount } = render(<ReportView {...props()} />);
      const line = screen.getByText("Next report Dec 1 to 1 recipient.");
      const order = [
        line,
        screen.getByRole("table"),
        screen.getByText("Report preview", { selector: "summary, summary *" }),
        screen.getByText("Branding", { selector: "summary, summary *" }),
      ];
      for (let i = 1; i < order.length; i++)
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      for (const d of container.querySelectorAll("details")) expect(d).not.toHaveAttribute("open");
      unmount();
      render(
        <ReportView
          {...props({
            settings: { brand_color: null, report_recipients: ["a@example.test", "b@example.test"], logoUrl: null },
          })}
        />,
      );
      expect(screen.getByText("Next report Dec 1 to 2 recipients.")).toBeInTheDocument();
    });

    it("no recipients yet: 'Add a recipient to send it.', Branding starts open and there's no test send", () => {
      const { container } = render(
        <ReportView {...props({ settings: { brand_color: null, report_recipients: [], logoUrl: null } })} />,
      );
      expect(screen.getByText("Next report Dec 1. Add a recipient to send it.")).toBeInTheDocument();
      const branding = [...container.querySelectorAll("details")].find((d) =>
        d.querySelector("summary")?.textContent?.includes("Branding"),
      );
      expect(branding).toHaveAttribute("open");
      expect(screen.queryByRole("button", { name: "Send test to me" })).toBeNull();
    });

    it("Save lights up only when a field changed, then 'Saved.'; the line and the test send follow what's saved", async () => {
      const a = actions();
      render(
        <ReportView
          {...props({ actions: a, settings: { brand_color: "#1D5FC5", report_recipients: [], logoUrl: null } })}
        />,
      );
      const save = screen.getByRole("button", { name: "Save" });
      expect(save).toBeEnabled();
      expect(save).not.toHaveClass("bg-accent");
      await userEvent.type(screen.getByLabelText("Recipients"), "a@example.test");
      expect(save).toHaveClass("bg-accent");
      // Typing doesn't count until it's saved.
      expect(screen.queryByRole("button", { name: "Send test to me" })).toBeNull();
      await userEvent.click(save);
      expect(await screen.findByText("Saved.")).toBeInTheDocument();
      expect(save).not.toHaveClass("bg-accent");
      expect(screen.getByText("Next report Dec 1 to 1 recipient.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send test to me" })).toBeInTheDocument();
      // Back to the saved value: nothing to save.
      fireEvent.change(screen.getByLabelText("Brand color"), { target: { value: "#0a7f3c" } });
      expect(save).toHaveClass("bg-accent");
      fireEvent.change(screen.getByLabelText("Brand color"), { target: { value: "#1d5fc5" } });
      expect(save).not.toHaveClass("bg-accent");
    });

    it("a failed save keeps Save lit and the line on the old recipients", async () => {
      const a = actions({ save: vi.fn(async () => ({ error: "failed" })) });
      render(<ReportView {...props({ actions: a })} />);
      await open("Branding");
      const save = screen.getByRole("button", { name: "Save" });
      await userEvent.type(screen.getByLabelText("Recipients"), "\nb@example.test");
      await userEvent.click(save);
      expect(await screen.findByText("We couldn't save that. Try again.")).toBeInTheDocument();
      expect(save).toHaveClass("bg-accent");
      expect(screen.getByText("Next report Dec 1 to 1 recipient.")).toBeInTheDocument();
    });
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
      "Connect GA4",
    ])
      expect(copy.slice(copy.indexOf("## Report (lead, 2026-11-05)"))).toContain(`"${s}"`);
    for (const s of [
      "Next report {date} to 1 recipient.",
      "Next report {date} to {n} recipients.",
      "Next report {date}. Add a recipient to send it.",
      "Branding",
    ])
      expect(copy.slice(copy.lastIndexOf("## UX (lead, 2026-11-06)"))).toContain(`"${s}"`);
  });
});
