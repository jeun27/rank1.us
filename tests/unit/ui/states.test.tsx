import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";

const field = { label: "Your domain", placeholder: "yoursite.com", buttonLabel: "Add my business" };

describe("EmptyState", () => {
  // UI.md "Empty": a 48–64px Jelly (X25 uses 56).
  it("shows Jelly (48-64px), the message and a Field + Button with exactly one submit button", () => {
    render(<EmptyState message="Nothing tracked yet." field={field} />);
    const jelly = screen.getByRole("img");
    const w = Number(jelly.getAttribute("width"));
    expect(w).toBeGreaterThanOrEqual(48);
    expect(w).toBeLessThanOrEqual(64);
    expect(screen.getByText("Nothing tracked yet.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your domain" })).toHaveAttribute("placeholder", "yoursite.com");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("type", "submit");
    expect(buttons[0]).toHaveAccessibleName("Add my business");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("LoadingState", () => {
  it("announces progress politely with a spinner and a computed bar; squish and spin stop for reduced motion", () => {
    render(<LoadingState message="Checking 4 AI engines…" done={120} total={250} />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-live", "polite");
    expect(within(el).getByText("Checking 4 AI engines…")).toBeInTheDocument();
    expect(within(el).getByText("120 of 250 answers")).toBeInTheDocument();
    expect(within(el).getByText("48%")).toBeInTheDocument();
    expect(within(el).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "120");
    const jelly = el.querySelector("img")!;
    expect(jelly.className).toContain("animate-squish");
    expect(jelly.className).toContain("motion-reduce:animate-none");
    const spinner = el.querySelector("[data-spinner]")!.getAttribute("class")!;
    expect(spinner).toContain("animate-spin");
    expect(spinner).toContain("motion-reduce:animate-none");
  });
});
