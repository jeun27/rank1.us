import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import { LockedPreview } from "@/components/app/LockedPreview";

// UI4 (O1, README §3 + §10): the unpaid Dashboard. The real headline only when BE2 found the business's own
// free audit; the Example cards sit in the grid flow with their headers and "Example data" badges outside the
// blur, and only the bodies blur (aria-hidden + inert); the Example matches the business type.
const NOW = new Date("2026-11-07T12:00:00Z");
const audit = { runId: "r1", named: 9, n: 40, checkedAt: "2026-11-05T12:00:00Z" };

describe("LockedPreview", () => {
  it("with the free audit: the real headline, the with-data title and line, one primary", () => {
    render(<LockedPreview vertical="plumbing" audit={audit} now={NOW} />);
    const head = screen.getByRole("region", { name: "From your free audit" });
    expect(within(head).getByText("22%")).toBeInTheDocument();
    expect(within(head).getByText("named in 9 of 40 answers · API-measured, directional")).toBeInTheDocument();
    expect(within(head).getByText(/^Checked 2 d(ays)? ago$/)).toBeInTheDocument();
    expect(screen.getByText("See who AI names instead of you, and how to change it")).toBeInTheDocument();
    expect(screen.getByText("The cards below are examples, not your data.")).toBeInTheDocument();
    expect(screen.queryByText(/Your first weekly check runs/)).toBeNull();
    const filled = screen.getAllByRole("link").filter((a) => a.className.includes("bg-accent"));
    expect(filled.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Start for $99/mo", "/app/billing"]]);
    expect(screen.getByRole("link", { name: "See a sample report" })).toHaveAttribute("href", "/#screenshots");
  });

  it("without one: no headline, the lead line, the without-data title and line", () => {
    render(<LockedPreview vertical="restaurant" audit={null} now={NOW} />);
    expect(screen.queryByText("From your free audit")).toBeNull();
    expect(
      screen.getByText("Your first weekly check runs after you start your plan. This is what it will show."),
    ).toBeInTheDocument();
    expect(screen.getByText("Find out who AI names instead of you")).toBeInTheDocument();
    expect(screen.getByText("Everything below is an example, not your data.")).toBeInTheDocument();
  });

  it("the three value lines and the screen-reader summary of what's locked", () => {
    render(<LockedPreview vertical="restaurant" audit={null} now={NOW} />);
    for (const t of [
      "Checks across ChatGPT, Gemini, Google AI Overview and Perplexity every week",
      "Your competitors ranked, with how many answers name each",
      "What to fix next, in order, with the answers it affects",
      "Locked behind the plan: your competitor ranking, per-engine results and your fix list.",
    ])
      expect(screen.getByText(t)).toBeInTheDocument();
  });

  it("only the card bodies blur: aria-hidden + inert, with the headers and Example data badges outside", () => {
    const { container } = render(<LockedPreview vertical="restaurant" audit={null} now={NOW} />);
    const blurred = [...container.querySelectorAll("[data-blurred]")];
    expect(blurred).toHaveLength(2);
    for (const b of blurred) {
      expect(b).toHaveAttribute("aria-hidden", "true");
      expect(b).toHaveAttribute("inert");
      expect(b.className).toContain("blur");
      expect(within(b as HTMLElement).queryByText("Example data")).toBeNull();
    }
    expect(screen.getAllByText("Example data")).toHaveLength(2);
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("What to fix next")).toBeInTheDocument();
  });

  it("the Example matches the business type: restaurant, local service, software/shop", () => {
    const names = (v: Parameters<typeof LockedPreview>[0]["vertical"]) => {
      const { container, unmount } = render(<LockedPreview vertical={v} audit={null} now={NOW} />);
      const t = container.querySelector("[data-blurred]")!.textContent!;
      unmount();
      return t;
    };
    expect(names("restaurant")).toMatch(/Example Izakaya/);
    expect(names("plumbing")).toMatch(/Example Plumbing Co/);
    expect(names("hvac")).toMatch(/Example Plumbing Co/);
    expect(names("saas")).toMatch(/Example Analytics/);
    expect(names("dtc")).toMatch(/Example Analytics/);
    expect(names(null)).toMatch(/Example Izakaya/);
  });
});

describe("Dashboard, no run yet", () => {
  const none = { points: [], visible: false };
  it("unpaid: the locked preview, with the free audit it's given", () => {
    render(
      <Dashboard
        business={{ name: "Example Plumbing Co", paid: false, vertical: "plumbing" }}
        latest={null}
        series={none}
        fixes={[]}
        now={NOW}
        freeAudit={audit}
      />,
    );
    expect(screen.getByRole("region", { name: "From your free audit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute("href", "/app/billing");
  });

  it("paid: the first-check empty state, no locked preview", () => {
    render(
      <Dashboard
        business={{ name: "Example Plumbing Co", paid: true }}
        latest={null}
        series={none}
        fixes={[]}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/Find out who AI names instead of you/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Start for $99/mo" })).toBeNull();
  });
});
