import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";

describe("Badge", () => {
  it.each([
    ["success", "bg-successBg", "text-moss"],
    ["error", "bg-errorBg", "text-brick"],
    ["warn", "bg-warnBg", "text-warnText"],
    ["info", "bg-infoBg", "text-jellyDeep"],
  ] as const)("%s uses %s / %s and is a pill", (tone, bg, fg) => {
    render(<Badge tone={tone}>x</Badge>);
    const el = screen.getByText("x");
    expect(el.className).toContain(bg);
    expect(el.className).toContain(fg);
    expect(el.className).toContain("rounded-full");
  });
});

describe("Banner", () => {
  it("error: white, 1.5px brick edge, brick text, 64px Jelly, one sentence and one text-link action", () => {
    render(
      <Banner tone="error" action={{ label: "Try again", href: "#" }}>
        We couldn&apos;t load your results. Try again.
      </Banner>,
    );
    const el = screen.getByRole("alert");
    const cls = el.className.split(" ");
    for (const c of [
      "bg-white",
      "border-[1.5px]",
      "border-brick",
      "text-brick",
      "rounded-banner",
      "shadow-banner-error",
    ])
      expect(cls).toContain(c);
    expect(el.className).not.toMatch(/bg-errorBg/);
    expect(screen.getByRole("link", { name: "Try again" }).className).toMatch(/text-jellyDeep/);
    const jelly = el.querySelector("img")!;
    expect(jelly).toHaveAttribute("alt", "");
    expect(jelly).toHaveAttribute("width", "64");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("info: white, 1.5px jellyDeep edge, jellyDeep text, infoBg 'i' chip, status role, no Jelly", () => {
    render(<Banner tone="info">Info</Banner>);
    const el = screen.getByRole("status");
    const cls = el.className.split(" ");
    for (const c of [
      "bg-white",
      "border-[1.5px]",
      "border-jellyDeep",
      "text-jellyDeep",
      "rounded-banner",
      "shadow-field",
    ])
      expect(cls).toContain(c);
    expect(el.className).not.toMatch(/bg-infoBg/);
    const chip = el.querySelector("[data-icon=info]")!.parentElement!;
    expect(chip.className).toContain("bg-infoBg");
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
