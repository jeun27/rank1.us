import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuroraButton } from "@/components/ui/AuroraButton";
import { DomainField } from "@/components/ui/DomainField";
import { Freshness } from "@/components/ui/Freshness";
import { ProgressBar, progressPercent } from "@/components/ui/ProgressBar";

const audit = {
  label: "Your domain",
  placeholder: "yourbusiness.com",
  buttonLabel: "Get my free audit",
  loadingLabel: "Checking…",
  errorText: "Add the ending, like ramenhouse.com",
};
const field = () => document.querySelector("[data-field]")!.className.split(" ");

describe("DomainField", () => {
  // Founder fix (17:05): a square button doesn't go inside a circle. The field is a rounded rectangle whose
  // radius nests the 6px button: rounded-nested (control radius + the 6px inset), in both layouts. The field
  // hugs the button with the same inset on every side, so it no longer has a fixed 60px height.
  it("default: labeled input, globe icon, nested-radius field (stacked below 21rem) with fieldBorder and the field shadow, primary submit inside", () => {
    render(<DomainField {...audit} />);
    const input = screen.getByRole("textbox", { name: "Your domain" });
    expect(input).toHaveAttribute("placeholder", "yourbusiness.com");
    expect(input).toHaveAttribute("inputmode", "url");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    for (const c of [
      "@min-[21rem]:flex-row",
      "rounded-nested",
      "p-1.5",
      "flex-col",
      "bg-white",
      "border",
      "border-fieldBorder",
      "shadow-field",
      "focus-within:outline-jellyDeep",
    ]) {
      expect(field()).toContain(c);
    }
    expect(field().filter((c) => /rounded-(full|banner)|h-15/.test(c))).toEqual([]);
    expect(document.querySelector("[data-field] [data-icon=globe]")).toHaveAttribute("aria-hidden", "true");
    const b = screen.getByRole("button", { name: "Get my free audit" });
    expect(b).toHaveAttribute("type", "submit");
    // v3 (D34/D35): the primary fill is the accent.
    expect(b.className.split(" ")).toContain("bg-accent");
  });

  it("focused: 2px jellyDeep edge", () => {
    render(<DomainField {...audit} focused defaultValue="ramenhouse.com" />);
    expect(screen.getByRole("textbox")).toHaveValue("ramenhouse.com");
    for (const c of ["outline-2", "-outline-offset-2", "outline-jellyDeep"]) expect(field()).toContain(c);
  });

  it("loading: lighter blue busy button with a spinner and 'Checking…'", () => {
    render(<DomainField {...audit} state="loading" />);
    const b = screen.getByRole("button", { name: "Checking…" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b.className.split(" ")).toContain("bg-jellyLoading");
    expect(b.querySelector("[data-spinner]")).not.toBeNull();
  });

  it("error: 2px brick edge, brick error text tied with aria-describedby and aria-invalid", () => {
    render(<DomainField {...audit} state="error" defaultValue="ramenhouse" />);
    for (const c of ["border-2", "border-brick"]) expect(field()).toContain(c);
    expect(field()).not.toContain("border-fieldBorder");
    const input = screen.getByRole("textbox", { name: "Your domain" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Add the ending, like ramenhouse.com");
    expect(screen.getByText("Add the ending, like ramenhouse.com").className).toContain("text-brick");
  });
});

describe("AuroraButton", () => {
  it("is a panel button (6px) with the aurora ring and shadow, jellyDeep label and spinner, busy while loading", () => {
    render(<AuroraButton loading>Opening Google…</AuroraButton>);
    const b = screen.getByRole("button", { name: "Opening Google…" });
    const cls = b.className.split(" ");
    // v3 (D35): the ring stays, on the 6px shape.
    for (const c of ["aurora-ring", "rounded-control", "shadow-aurora", "text-jellyDeep"]) expect(cls).toContain(c);
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b.querySelector("[data-spinner]")!.getAttribute("class")).toContain("motion-reduce:animate-none");
  });
});

describe("ProgressBar", () => {
  it("computes a floored percent", () => {
    expect(progressPercent(120, 250)).toBe(48);
    expect(progressPercent(2, 3)).toBe(66);
    expect(progressPercent(0, 250)).toBe(0);
    expect(progressPercent(250, 250)).toBe(100);
    expect(progressPercent(300, 250)).toBe(100);
    expect(progressPercent(0, 0)).toBeNull();
  });

  it("shows 'n of d answers', the percent and a fill as wide as the percent", () => {
    render(<ProgressBar done={120} total={250} />);
    const bar = screen.getByRole("progressbar", { name: "120 of 250 answers" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "250");
    expect(bar).toHaveAttribute("aria-valuenow", "120");
    // v3 (UI.md Loading + progress): the fill is sized by scaleX.
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("scaleX(0.48)");
    expect(screen.getByText("48%").className).toContain("text-jellyDeep");
    expect(screen.getByText("120 of 250 answers").className).toContain("text-inkMuted");
  });

  it("shows no percent when there are no answers to count", () => {
    render(<ProgressBar done={0} total={0} />);
    expect(screen.getByText("0 of 0 answers")).toBeInTheDocument();
    expect(screen.queryByText(/%$/)).toBeNull();
  });
});

describe("Freshness", () => {
  it("has a clock icon before the caption", () => {
    render(<Freshness checkedAt="2026-11-04T22:00:00Z" answers={250} now={new Date("2026-11-05T12:00:00Z")} />);
    const p = screen.getByText("Checked 14 h ago · 250 answers · API-measured, directional");
    expect(p.firstElementChild).toHaveAttribute("data-icon", "clock");
  });
});
