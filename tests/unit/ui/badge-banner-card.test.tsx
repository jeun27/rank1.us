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
// DQ6: one icon language. A bare 16px stroke icon, no disc around it (a circle in a circle), centred on
// the first text line (a 1lh box, since banners inherit 13/19 or 16/24) so it stays put when the text wraps.
function expectBareIcon(banner: HTMLElement, name: string) {
  const icon = banner.querySelector(`svg[data-icon=${name}]`)!;
  expect(icon).not.toBeNull();
  expect(icon.getAttribute("class")!.split(" ")).toContain("size-4");
  expect(icon.parentElement!.className.split(" ")).toEqual(expect.arrayContaining(["h-[1lh]", "items-center"]));
  expect(banner.querySelector(".rounded-full")).toBeNull();
}

describe("Banner", () => {
  it("error: errorBg fill, 1px error hairline at 30%, radius 8, a bare 16px alert icon, one Inter 500 sentence, one text action", () => {
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
    // DQ6 (Q3): no Jelly in a banner. Jelly is for empty and loading moments.
    expect(el.querySelector("img")).toBeNull();
    expectBareIcon(el, "alert");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("info: infoBg fill, 1px info hairline at 25%, radius 8, a bare 16px info icon, info text, status role, no Jelly", () => {
    render(<Banner tone="info">Info</Banner>);
    const el = screen.getByRole("status");
    const cls = el.className.split(" ");
    for (const c of ["bg-infoBg", "border", "border-jellyDeep/25", "text-jellyDeep", "rounded-banner"])
      expect(cls).toContain(c);
    expect(el.className).not.toMatch(/bg-white|border-\[1\.5px\]|shadow-field/);
    expectBareIcon(el, "info");
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

// PR 27 (lead item 22): a warn banner, warnBg/warnText with role=status, for a connection that needs
// attention; its action can be the screen's one filled button.
describe("Banner warn", () => {
  it("warnBg + warnText, role=status, and a primary action when asked", async () => {
    const { Banner } = await import("@/components/ui/Banner");
    const { render, screen } = await import("@testing-library/react");
    render(
      <Banner tone="warn" action={{ label: "Reconnect", onClick: () => {} }} primary>
        Google Business Profile: Needs reconnect
      </Banner>,
    );
    const el = screen.getByRole("status");
    for (const c of ["bg-warnBg", "text-warnText", "rounded-banner"]) expect(el.className).toContain(c);
    expectBareIcon(el, "alert");
    expect(screen.getByRole("button", { name: "Reconnect" }).className).toContain("bg-accent");
  });
});
