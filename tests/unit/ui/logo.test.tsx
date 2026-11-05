import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/ui/Logo";

describe("Logo", () => {
  it("is the bar mark (currentColor) left of the 'Rank1' wordmark in Fraunces 600, 18px, ink", () => {
    const { container } = render(<Logo />);
    const lockup = container.firstElementChild!;
    expect(lockup.className).toContain("text-ink");
    const mark = lockup.firstElementChild!;
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveAttribute("fill", "currentColor");
    expect(mark.querySelectorAll("path")).toHaveLength(3);
    const word = screen.getByText("Rank1");
    expect(word.className).toContain("font-display");
    expect(word.className).toContain("font-semibold");
    expect(word.className).toContain("text-wordmark");
    expect(mark.compareDocumentPosition(word) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
