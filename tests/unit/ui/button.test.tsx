import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";

// v3 (D35, founder-approved): 6px radius, 32h from md (lg 40h in the landing hero), press feedback (D24).
// Below md every button is 44px tall (lead, O2: UI.md keeps "44px below md").
describe("Button", () => {
  it("primary is the accent fill with onAccent text, 32px tall, 6px radius, 1px press", () => {
    render(<Button>Get my free audit</Button>);
    const b = screen.getByRole("button", { name: "Get my free audit" });
    const cls = b.className.split(" ");
    for (const c of ["bg-accent", "text-onAccent", "h-11", "md:h-8", "rounded-control", "active:translate-y-px"])
      expect(cls).toContain(c);
    expect(b.className).not.toMatch(/rounded-full|shadow-button/);
  });
  it("size lg is the 40px landing hero button", () => {
    render(<Button size="lg">Get my free audit</Button>);
    const cls = screen.getByRole("button").className.split(" ");
    expect(cls).toContain("h-11");
    expect(cls).toContain("md:h-10");
    expect(cls).not.toContain("md:h-8");
  });
  // Portal R1: links are the link colour (white in dark) and always underlined, never colour alone.
  it("secondary is an underlined link-colour text link with a 44px tap area and an arrow that nudges on hover", () => {
    render(
      <Button variant="secondary" href="/pricing">
        See pricing
      </Button>,
    );
    const a = screen.getByRole("link", { name: "See pricing" });
    expect(a).toHaveAttribute("href", "/pricing");
    expect(a.className.split(" ")).toEqual(expect.arrayContaining(["text-link", "underline"]));
    expect(a.className).not.toMatch(/hover:underline/);
    expect(a.className).toMatch(/min-h-11/);
    expect(a.className).not.toMatch(/bg-|shadow/);
    const arrow = a.lastElementChild!;
    expect(arrow).toHaveAttribute("data-icon", "arrowRight");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("class")).toMatch(/group-hover:translate-x-0\.5/);
    expect(arrow.getAttribute("class")).toMatch(/motion-reduce:transition-none/);
  });
  it("alt is the raised fill with a control-edge hairline (D35 .alt)", () => {
    render(<Button variant="alt">Manage billing</Button>);
    const cls = screen.getByRole("button").className.split(" ");
    for (const c of ["bg-raised", "border", "border-fieldBorder", "text-ink", "rounded-control", "h-11", "md:h-8"])
      expect(cls).toContain(c);
  });
  it("final CTA uses the accent too (amber is no longer a button colour), at the lg size", () => {
    render(<Button variant="final">Get my free audit</Button>);
    const b = screen.getByRole("button");
    expect(b.className).toMatch(/bg-accent/);
    expect(b.className).toMatch(/md:h-10/);
    expect(b.className).not.toMatch(/bg-amber/);
  });
  it("loading disables the button, marks it busy, uses jellyLoading and a spinner that stops for reduced motion", () => {
    render(<Button loading>Checking…</Button>);
    const b = screen.getByRole("button", { name: "Checking…" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    const cls = b.className.split(" ");
    expect(cls).toContain("bg-jellyLoading");
    expect(cls).toContain("rounded-control");
    expect(cls).not.toContain("bg-accent");
    const spinner = b.querySelector("[data-spinner]")!;
    expect(spinner.getAttribute("class")).toContain("animate-spin");
    expect(spinner.getAttribute("class")).toContain("motion-reduce:animate-none");
  });
  it("disabled is a real disabled button: control-edge outline, muted label, lock icon", () => {
    render(<Button disabled>Add business</Button>);
    const b = screen.getByRole("button", { name: "Add business" });
    expect(b).toBeDisabled();
    const cls = b.className.split(" ");
    for (const c of ["rounded-control", "h-11", "md:h-8", "border", "border-fieldBorder", "text-inkMuted"])
      expect(cls).toContain(c);
    expect(cls).not.toContain("bg-accent");
    expect(screen.getByText("Add business").className).toBe("opacity-75");
    expect(b.querySelector("[data-icon=lock]")).toHaveAttribute("aria-hidden", "true");
  });
});
