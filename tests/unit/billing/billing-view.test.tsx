import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BillingView } from "@/components/billing/BillingView";

const actions = (over = {}) => ({
  checkout: vi.fn(async () => undefined),
  portal: vi.fn(async () => undefined),
  ...over,
});
const paid = { status: "active" as const, seats: 2, nextInvoiceAt: "2026-12-01T00:00:00Z" };

// UI.md 4b "Billing + switcher". Amounts are the x $99 math, never fetched from Stripe.
describe("BillingView (/app/billing)", () => {
  // Lead (#74 review): Checkout only without a live subscription.
  // incomplete_expired is terminal in Stripe like canceled, so it may Checkout again (lead).
  it.each([null, "canceled", "incomplete_expired"] as const)(
    "no live subscription (%s): 'Start for $99/mo' opens Checkout",
    async (status) => {
      const a = actions();
      render(<BillingView billing={{ status, seats: 0, nextInvoiceAt: null }} actions={a} />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Billing");
      await userEvent.click(screen.getByRole("button", { name: "Start for $99/mo" }));
      expect(a.checkout).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Manage billing" })).toBeNull();
    },
  );

  it("paid: Plan, the x $99 math, the next invoice and 'Manage billing' (spinner while opening)", async () => {
    let open!: () => void;
    const a = actions({ portal: vi.fn(() => new Promise<void>((r) => (open = r))) });
    render(<BillingView billing={paid} actions={a} />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("2 businesses x $99 = $198/mo")).toBeInTheDocument();
    expect(screen.getByText("Next invoice Dec 1, 2026")).toBeInTheDocument();
    const manage = screen.getByRole("button", { name: /Manage billing/ });
    await userEvent.click(manage);
    expect(a.portal).toHaveBeenCalledTimes(1);
    expect(manage).toHaveAttribute("aria-busy", "true");
    open();
  });

  it("one business reads in the singular", () => {
    render(<BillingView billing={{ ...paid, seats: 1 }} actions={actions()} />);
    expect(screen.getByText("1 business x $99 = $99/mo")).toBeInTheDocument();
  });

  it("past due: the failed banner with 'Update card' (portal) and the 'Past due' badge", async () => {
    const a = actions();
    render(<BillingView billing={{ ...paid, status: "past_due" }} actions={a} />);
    expect(screen.getByText("Your last payment failed. Weekly checks are paused.")).toBeInTheDocument();
    expect(screen.getByText("Past due")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Update card" }));
    expect(a.portal).toHaveBeenCalledTimes(1);
  });

  // Lead (Q1): every failed-payment status keeps the plan with the "Past due" badge and 'Manage billing'.
  it.each(["unpaid", "incomplete"] as const)(
    "%s: the failed banner, 'Update card', the plan with the 'Past due' badge and 'Manage billing'",
    (status) => {
      render(<BillingView billing={{ ...paid, status }} actions={actions()} />);
      expect(screen.getByText("Your last payment failed. Weekly checks are paused.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update card" })).toBeInTheDocument();
      expect(screen.getByText("Past due")).toBeInTheDocument();
      expect(screen.getByText("2 businesses x $99 = $198/mo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
    },
  );

  it.each(["incomplete", "past_due", "unpaid"] as const)(
    "%s: never a second Checkout; 'Update card' opens the portal",
    async (status) => {
      const a = actions();
      render(<BillingView billing={{ ...paid, status }} actions={a} />);
      expect(screen.queryByRole("button", { name: "Start for $99/mo" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Update card" }));
      expect(a.portal).toHaveBeenCalledTimes(1);
      expect(a.checkout).not.toHaveBeenCalled();
    },
  );

  it("paused: the plan with the 'Paused' warn badge and 'Manage billing' (portal), no Checkout", async () => {
    const a = actions();
    render(<BillingView billing={{ ...paid, status: "paused" }} actions={a} />);
    expect(screen.queryByRole("button", { name: "Start for $99/mo" })).toBeNull();
    expect(screen.getByText("2 businesses x $99 = $198/mo")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    expect(a.portal).toHaveBeenCalledTimes(1);
    expect(a.checkout).not.toHaveBeenCalled();
  });

  it("Checkout or portal failure: 'We couldn't open billing. Try again in a minute.'", async () => {
    render(
      <BillingView
        billing={{ status: null, seats: 0, nextInvoiceAt: null }}
        actions={actions({ checkout: vi.fn(async () => ({ error: "failed" })) })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Start for $99/mo" }));
    expect(await screen.findByText("We couldn't open billing. Try again in a minute.")).toBeInTheDocument();
  });

  it("COPY.md has the lead's Billing strings", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    expect(copy).toMatch(/## Billing \(lead, 2026-11-05\)/);
    for (const s of [
      "Cancel",
      "More for {name}",
      "Search businesses",
      "Past due",
      "Plan",
      "Next invoice {date}",
      "Adding your business…",
      "the end of this period",
      "We couldn't open billing. Try again in a minute.",
    ])
      expect(copy).toContain(`"${s}"`);
  });
});
