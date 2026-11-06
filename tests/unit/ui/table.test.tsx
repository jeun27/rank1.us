import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table } from "@/components/ui/Table";

const columns = [
  { key: "b", header: "Business" },
  { key: "v", header: "Visibility", numeric: true },
  { key: "c", header: "Change", numeric: true },
];
const rows = [
  { b: "Example Noodle Bar", v: "100%", c: "–" },
  { b: "Example Ramen House", v: "33%", c: "+3 pts" },
];

// X8 (UI.md Table, D43): below md a stacked row keeps the label and the result on one line, so the key
// column is never scrolled off. The You row is pinned first on phones and tinted at every width.
describe("Table stack + pin", () => {
  it("without stack, nothing changes: no phone grid, no header prefix", () => {
    render(<Table caption="Competitors" columns={columns} rows={rows} />);
    const table = screen.getByRole("table", { name: "Competitors" });
    expect(table.querySelector("tr.max-md\\:grid")).toBeNull();
    expect(table.querySelector("[data-stack-label]")).toBeNull();
  });

  it("stack: line 1 = the first column + the first numeric column; the rest go under with their header", () => {
    render(<Table caption="Competitors" columns={columns} rows={rows} stack />);
    const table = screen.getByRole("table", { name: "Competitors" });
    expect(table.querySelector("thead")).toHaveClass("max-md:sr-only");
    const [, row] = within(table).getAllByRole("row").slice(1);
    expect(row).toHaveClass("max-md:grid");
    const [label, result, change] = within(row).getAllByRole("cell");
    expect(label).toHaveClass("max-md:row-start-1", "max-md:col-start-1");
    expect(result).toHaveClass("max-md:row-start-1", "max-md:col-start-2");
    expect(change).toHaveClass("max-md:col-span-2");
    // The visible prefix repeats the column header for sighted phone users only.
    const prefix = change.querySelector("[data-stack-label]")!;
    expect(prefix).toHaveTextContent("Change");
    expect(prefix).toHaveAttribute("aria-hidden", "true");
    expect(prefix).toHaveClass("md:hidden");
  });

  it("pin: the pinned row moves first on phones only (DOM order kept) and gets the infoBg tint", () => {
    render(<Table caption="Competitors" columns={columns} rows={rows} stack pin={(i) => i === 1} />);
    const table = screen.getByRole("table", { name: "Competitors" });
    expect(table.querySelector("tbody")).toHaveClass("max-md:flex", "max-md:flex-col");
    const [first, you] = within(table).getAllByRole("row").slice(1);
    expect(you).toHaveTextContent("Example Ramen House");
    expect(you).toHaveClass("max-md:order-first", "bg-infoBg");
    expect(first).not.toHaveClass("max-md:order-first");
    expect(first).not.toHaveClass("bg-infoBg");
  });
});

// Reviewer S1 on #130: Safari can drop table semantics when CSS changes display on tr/tbody, so the
// stacked table states its roles; each cell still resolves its column header.
describe("Table stack roles", () => {
  it("stacked tables carry explicit table, rowgroup, row, columnheader and cell roles", () => {
    const { container } = render(<Table caption="Competitors" columns={columns} rows={rows} stack />);
    expect(container.querySelector("table")).toHaveAttribute("role", "table");
    for (const g of container.querySelectorAll("thead, tbody")) expect(g).toHaveAttribute("role", "rowgroup");
    for (const r of container.querySelectorAll("tr")) expect(r).toHaveAttribute("role", "row");
    for (const h of container.querySelectorAll("th")) expect(h).toHaveAttribute("role", "columnheader");
    for (const d of container.querySelectorAll("td")) expect(d).toHaveAttribute("role", "cell");
    const table = screen.getByRole("table", { name: "Competitors" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Business", "Visibility", "Change"]);
  });

  it("plain tables stay plain markup", () => {
    const { container } = render(<Table caption="Competitors" columns={columns} rows={rows} />);
    expect(container.querySelector("table")).not.toHaveAttribute("role");
  });
});
