import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { Hero } from "@/components/site/Hero";
import { ScreenshotTabs } from "@/components/site/ScreenshotTabs";
import { sentence } from "@/components/site/Faq";
import { heroCardText, heroLastWeek, heroThisWeek } from "@/components/site/example-data";

beforeAll(() => {
  // jsdom has no IntersectionObserver; the sticky bar only needs observe/disconnect here.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("hero card numbers", () => {
  it("are computed from the example fixture: 55 of 160 = 34%, 45 of 160 last week = +6 pts", () => {
    expect(heroCardText(heroThisWeek, heroLastWeek)).toBe("named in 34% of 160 answers, +6 pts");
  });
  it("follow the fixture, not a typed string", () => {
    const m = (n: number, d: number) => ({ value: n / d, numerator: n, denominator: d });
    expect(heroCardText(m(9, 30), m(12, 30))).toBe("named in 30% of 30 answers, −10 pts");
  });
  it("the hero renders the computed text next to the Example data label", () => {
    const { container } = render(<Hero />);
    expect(container.querySelector("[data-hero-text]")?.textContent).toBe(heroCardText(heroThisWeek, heroLastWeek));
    expect(within(container.querySelector("[data-hero-card]") as HTMLElement).getByText("Example data")).toBeInTheDocument();
  });
});

describe("social proof flag", () => {
  const heading = "Built for businesses that want AI to name them.";
  it("renders nothing when SHOW_SOCIAL_PROOF is unset (default)", () => {
    vi.stubEnv("SHOW_SOCIAL_PROOF", undefined);
    render(<Home />);
    expect(screen.queryByText(heading)).toBeNull();
    expect(screen.queryByText("[PLACEHOLDER LOGO]")).toBeNull();
  });
  it("renders nothing when SHOW_SOCIAL_PROOF=false", () => {
    vi.stubEnv("SHOW_SOCIAL_PROOF", "false");
    render(<Home />);
    expect(screen.queryByText(heading)).toBeNull();
  });
  it("renders the heading, 5 placeholder logos and 1 placeholder testimonial when SHOW_SOCIAL_PROOF=true", () => {
    vi.stubEnv("SHOW_SOCIAL_PROOF", "true");
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    expect(screen.getAllByText("[PLACEHOLDER LOGO]")).toHaveLength(5);
    expect(screen.getAllByText("[PLACEHOLDER TESTIMONIAL - real, with permission]")).toHaveLength(1);
  });
});

describe("ScreenshotTabs", () => {
  const tabs = ["Dashboard", "Monthly report", "Audit CSV"].map((label) => ({ label, panel: <p>{`${label} panel`}</p> }));
  it("moves with arrow keys, wraps, and supports Home/End", async () => {
    const user = userEvent.setup();
    render(<ScreenshotTabs tabs={tabs} />);
    const [a, b, c] = screen.getAllByRole("tab");
    expect(a).toHaveAttribute("aria-selected", "true");
    await user.click(a);
    await user.keyboard("{ArrowRight}");
    expect(b).toHaveFocus();
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Monthly report panel");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(a).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(c).toHaveFocus();
    await user.keyboard("{Home}");
    expect(a).toHaveFocus();
    await user.keyboard("{End}");
    expect(c).toHaveAttribute("aria-selected", "true");
    expect(a).toHaveAttribute("tabindex", "-1");
    expect(c).toHaveAttribute("tabindex", "0");
  });
});

describe("FAQ answers", () => {
  it("capitalize the COPY.md phrase and add a closing period, nothing else", () => {
    expect(sentence("about 5 minutes")).toBe("About 5 minutes.");
    expect(sentence("ChatGPT, Gemini, Google AI Overview, Perplexity")).toBe("ChatGPT, Gemini, Google AI Overview, Perplexity.");
  });
});
