import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/auth/AppHeader";

// UI.md:8 / D40 (QA gap): /client has the same light/dark toggle as /app and /team, on the same prefs.
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
);
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AppHeader (the /client header)", () => {
  it("has the 'Dark theme' toggle (aria-pressed) next to Account", () => {
    render(<AppHeader />);
    const header = screen.getByRole("banner");
    // X9a: md+ shows it in the bar (hidden below md); phones get the same toggle inside Account.
    const [bar, phone] = within(header).getAllByRole("button", { name: "Dark theme" });
    expect(bar).toHaveAttribute("aria-pressed");
    expect(bar.closest("details")).toBeNull();
    expect(bar.parentElement).toHaveClass("max-md:hidden");
    expect(phone.closest("details")).not.toBeNull();
    expect(phone.parentElement).toHaveClass("md:hidden");
  });
});
