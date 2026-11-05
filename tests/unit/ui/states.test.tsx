import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";

describe("EmptyState", () => {
  it("shows Jelly (64-96px), the message and exactly one primary action", () => {
    render(<EmptyState message="Nothing tracked yet." action={{ label: "Add my business", href: "/onboarding" }} />);
    const jelly = screen.getByRole("img");
    const w = Number(jelly.getAttribute("width"));
    expect(w).toBeGreaterThanOrEqual(64);
    expect(w).toBeLessThanOrEqual(96);
    expect(screen.getByText("Nothing tracked yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("LoadingState", () => {
  it("announces progress politely, squishes, and stays still for reduced motion", () => {
    render(<LoadingState message="Checking 4 AI engines… 120 of 250 answers" />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Checking 4 AI engines… 120 of 250 answers")).toBeInTheDocument();
    const jelly = el.querySelector("img")!;
    expect(jelly.className).toContain("animate-squish");
    expect(jelly.className).toContain("motion-reduce:animate-none");
  });
});
