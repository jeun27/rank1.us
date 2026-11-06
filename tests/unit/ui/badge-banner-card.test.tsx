import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";

// v3 (UI.md "Badge / tag", lead C1): radius 4, 20h, Inter 500 11px, state fill + text + a 25% state hairline.
describe("Badge", () => {
  it.each([
    ["success", "bg-successBg", "text-moss"],
    ["error", "bg-errorBg", "text-brick"],
    ["warn", "bg-warnBg", "text-warnText"],
    ["info", "bg-infoBg", "text-jellyDeep"],
  ] as const)("%s uses %s / %s on the v3 tag shape", (tone, bg, fg) => {
    render(<Badge tone={tone}>x</Badge>);
    const cls = screen.getByText("x").className.split(" ");
    for (const c of [bg, fg, "rounded-tag", "h-5", "text-tag", "font-medium", "border", "border-current/25"])
      expect(cls).toContain(c);
    expect(cls).not.toContain("rounded-full");
  });
});

// v3 (UI.md "Error banner" / "Info banner", lead C2).
describe("Banner", () => {
  it("error: errorBg fill, 1px error hairline at 30%, radius 8, 48px Jelly, one Inter 500 sentence, one text action", () => {
    render(
      <Banner tone="error" action={{ label: "Try again", href: "#" }}>
        We couldn&apos;t load your results. Try again.
      </Banner>,
    );
    const el = screen.getByRole("alert");
    const cls = el.className.split(" ");
    for (const c of ["bg-errorBg", "border", "border-brick/30", "text-brick", "rounded-banner"])
      expect(cls).toContain(c);
    expect(el.className).not.toMatch(/bg-white|border-\[1\.5px\]|shadow-banner-error/);
    expect(screen.getByText(/We couldn.t load your results/).className.split(" ")).toContain("font-medium");
    expect(screen.getByRole("link", { name: "Try again" }).className).toMatch(/text-link/);
    const jelly = el.querySelector("img")!;
    expect(jelly).toHaveAttribute("alt", "");
    expect(jelly).toHaveAttribute("width", "48");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("info: infoBg fill, 1px info hairline at 25%, radius 8, 28px info chip, info text, status role, no Jelly", () => {
    render(<Banner tone="info">Info</Banner>);
    const el = screen.getByRole("status");
    const cls = el.className.split(" ");
    for (const c of ["bg-infoBg", "border", "border-jellyDeep/25", "text-jellyDeep", "rounded-banner"])
      expect(cls).toContain(c);
    expect(el.className).not.toMatch(/bg-white|border-\[1\.5px\]|shadow-field/);
    const chip = el.querySelector("[data-icon=info]")!.parentElement!;
    expect(chip.className.split(" ")).toContain("size-7");
    expect(chip.className).toContain("rounded-full");
    expect(el.querySelector("img")).toBeNull();
  });
});

describe("Card", () => {
  it("white surface, radius 24, card shadow, no border, padding 16 mobile / 24 md", () => {
    render(<Card title="Leaderboard">body</Card>);
    const el = screen.getByText("body").closest("section")!;
    const cls = el.className.split(" ");
    for (const c of ["bg-white", "rounded-surface", "shadow-card", "p-4", "md:p-6"]) expect(cls).toContain(c);
    expect(el.className).not.toMatch(/\bborder|bg-paper|rounded-card/);
    expect(screen.getByRole("heading", { level: 3, name: "Leaderboard" })).toBeInTheDocument();
  });
});
