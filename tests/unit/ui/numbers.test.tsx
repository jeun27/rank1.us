import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatNumber } from "@/components/ui/StatNumber";
import { Freshness, formatAge } from "@/components/ui/Freshness";
import { Table } from "@/components/ui/Table";

describe("StatNumber", () => {
  it("shows the percent and its sample size, tabular", () => {
    render(<StatNumber metric={{ value: 0.3, numerator: 9, denominator: 30 }} />);
    const n = screen.getByText("30%");
    expect(n.className).toContain("tabular-nums");
    expect(n.className).toContain("font-display");
    expect(screen.getByText("named in 9 of 30 answers")).toBeInTheDocument();
  });
  it("never rounds up: 2 of 3 shows 66%", () => {
    render(<StatNumber metric={{ value: 2 / 3, numerator: 2, denominator: 3 }} />);
    expect(screen.getByText("66%")).toBeInTheDocument();
  });
  it("shows a dash, not 0%, when there are no successful answers", () => {
    render(<StatNumber metric={{ value: null, numerator: 0, denominator: 0 }} />);
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });
});

describe("Freshness", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("matches the UI.md string exactly", () => {
    render(<Freshness checkedAt="2026-11-04T22:00:00Z" answers={250} now={now} />);
    expect(screen.getByText("Checked 14 h ago · 250 answers · API-measured, directional")).toBeInTheDocument();
  });
  it("formats ages", () => {
    expect(formatAge(new Date("2026-11-05T11:40:00Z"), now)).toBe("20 min");
    expect(formatAge(new Date("2026-11-03T12:00:00Z"), now)).toBe("2 d");
  });
  it("is a tabular caption in inkMuted", () => {
    render(<Freshness checkedAt={now} answers={1} now={now} />);
    const el = screen.getByText(/1 answer ·/);
    expect(el.className).toContain("text-inkMuted");
    expect(el.className).toContain("tabular-nums");
  });
});

describe("Table", () => {
  it("right-aligns numeric columns with tabular figures and shows a footnote", () => {
    render(
      <Table
        caption="Leaderboard"
        columns={[{ key: "brand", header: "Brand" }, { key: "vis", header: "Visibility", numeric: true }]}
        rows={[{ brand: "Example Ramen House", vis: "30%" }]}
        footnote="footnote here"
      />,
    );
    const cell = screen.getByText("30%");
    expect(cell.className).toContain("text-right");
    expect(cell.className).toContain("tabular-nums");
    expect(screen.getByRole("columnheader", { name: "Visibility" }).className).toContain("text-inkMuted");
    expect(screen.getByText("footnote here")).toBeInTheDocument();
  });
});
