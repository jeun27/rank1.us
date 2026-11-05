import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("primary is a jellyDeep pill with white text, 48px tall, with the button shadow", () => {
    render(<Button>Get my free audit</Button>);
    const b = screen.getByRole("button", { name: "Get my free audit" });
    const cls = b.className.split(" ");
    for (const c of ["bg-jellyDeep", "text-white", "h-12", "rounded-full", "shadow-button"]) expect(cls).toContain(c);
    expect(b.className).not.toMatch(/rounded-card/);
  });
  it("secondary is a jellyDeep text link with a 44px tap area and an arrow after the label", () => {
    render(<Button variant="secondary" href="/pricing">See pricing</Button>);
    const a = screen.getByRole("link", { name: "See pricing" });
    expect(a).toHaveAttribute("href", "/pricing");
    expect(a.className).toMatch(/text-jellyDeep/);
    expect(a.className).toMatch(/min-h-11/);
    expect(a.className).not.toMatch(/bg-|shadow/);
    const arrow = a.lastElementChild!;
    expect(arrow).toHaveAttribute("data-icon", "arrowRight");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
  });
  it("final CTA is amber with ink text", () => {
    render(<Button variant="final">Get my free audit</Button>);
    const b = screen.getByRole("button");
    expect(b.className).toMatch(/bg-amber/);
    expect(b.className).toMatch(/text-ink/);
  });
  it("loading disables the button, marks it busy, uses jellyLoading and a spinner that stops for reduced motion", () => {
    render(<Button loading>Checking…</Button>);
    const b = screen.getByRole("button", { name: "Checking…" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    const cls = b.className.split(" ");
    expect(cls).toContain("bg-jellyLoading");
    expect(cls).toContain("rounded-full");
    expect(cls).not.toContain("bg-jellyDeep");
    const spinner = b.querySelector("[data-spinner]")!;
    expect(spinner.getAttribute("class")).toContain("animate-spin");
    expect(spinner.getAttribute("class")).toContain("motion-reduce:animate-none");
  });
  it("disabled is a real disabled button: outlined pill, faded inkMuted label, lock icon", () => {
    render(<Button disabled>Add business</Button>);
    const b = screen.getByRole("button", { name: "Add business" });
    expect(b).toBeDisabled();
    const cls = b.className.split(" ");
    for (const c of ["rounded-full", "h-12.5", "border-[1.5px]", "border-ink/14", "bg-white/55", "text-inkMuted"]) expect(cls).toContain(c);
    expect(cls).not.toContain("bg-jellyDeep");
    expect(cls).not.toContain("shadow-button");
    expect(screen.getByText("Add business").className).toBe("opacity-75");
    expect(b.querySelector("[data-icon=lock]")).toHaveAttribute("aria-hidden", "true");
  });
});
