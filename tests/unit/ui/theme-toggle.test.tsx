import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PREFS_KEY } from "@/lib/workspace/prefs";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

// v3 O2 on /app: one button, the existing "Dark theme" label, the stored choice shared with /team.
describe("ThemeToggle", () => {
  it("shows the current theme and switches it, persisting the choice", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<ThemeToggle />);
    const b = screen.getByRole("button", { name: "Dark theme" });
    expect(b).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(b);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!).theme).toBe("light");
    expect(b).toHaveAttribute("aria-pressed", "false");
  });
});
