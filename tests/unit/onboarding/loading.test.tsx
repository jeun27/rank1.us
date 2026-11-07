import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "@/app/app/onboarding/loading";

// v0.8.2 QA F1: /app/onboarding inherited /app's Dashboard skeleton, so every load painted "Dashboard" first.
describe("onboarding loading", () => {
  it("paints the onboarding H1, never Dashboard", () => {
    render(<Loading />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Add your business");
    expect(screen.queryByText("Dashboard")).toBeNull();
  });
});
