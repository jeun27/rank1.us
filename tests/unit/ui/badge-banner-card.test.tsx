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
  it("error: errorBg, brick text, 64px Jelly, one sentence and one action", () => {
    render(<Banner tone="error" action={{ label: "Try again", href: "#" }}>We couldn&apos;t load your results. Try again.</Banner>);
    const el = screen.getByRole("alert");
    expect(el.className).toContain("bg-errorBg");
    expect(el.className).toContain("text-brick");
    const jelly = el.querySelector("img")!;
    expect(jelly).toHaveAttribute("alt", "");
    expect(jelly).toHaveAttribute("width", "64");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("info: infoBg, jellyDeep text, status role, no Jelly", () => {
    render(<Banner tone="info">Info</Banner>);
    const el = screen.getByRole("status");
    expect(el.className).toContain("bg-infoBg");
    expect(el.className).toContain("text-jellyDeep");
    expect(el.querySelector("img")).toBeNull();
  });
});

describe("Card", () => {
  it("paper, 1px ink/15% border, radius 8, padding 16 mobile / 24 md, no shadow", () => {
    render(<Card title="Leaderboard">body</Card>);
    const el = screen.getByText("body").closest("section")!;
    for (const c of ["bg-paper", "border", "border-border", "rounded-card", "p-4", "md:p-6"]) expect(el.className).toContain(c);
    expect(el.className).not.toMatch(/shadow/);
    expect(screen.getByRole("heading", { level: 3, name: "Leaderboard" })).toBeInTheDocument();
  });
});
