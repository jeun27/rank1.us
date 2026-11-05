import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("primary is jellyDeep with white text, 44px tall, radius 8", () => {
    render(<Button>Get my free audit</Button>);
    const b = screen.getByRole("button", { name: "Get my free audit" });
    expect(b.className).toMatch(/bg-jellyDeep/);
    expect(b.className).toMatch(/text-white/);
    expect(b.className).toMatch(/h-11/);
    expect(b.className).toMatch(/rounded-card/);
    expect(b.className).not.toMatch(/rounded-full/);
  });
  it("secondary is a jellyDeep text link with a 44px tap area", () => {
    render(<Button variant="secondary" href="/pricing">See pricing</Button>);
    const a = screen.getByRole("link", { name: "See pricing" });
    expect(a).toHaveAttribute("href", "/pricing");
    expect(a.className).toMatch(/text-jellyDeep/);
    expect(a.className).toMatch(/min-h-11/);
    expect(a.className).not.toMatch(/bg-/);
  });
  it("final CTA is amber with ink text", () => {
    render(<Button variant="final">Get my free audit</Button>);
    const b = screen.getByRole("button");
    expect(b.className).toMatch(/bg-amber/);
    expect(b.className).toMatch(/text-ink/);
  });
  it("loading disables the button and marks it busy", () => {
    render(<Button loading>Opening Google…</Button>);
    const b = screen.getByRole("button", { name: /Opening Google…/ });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
});
