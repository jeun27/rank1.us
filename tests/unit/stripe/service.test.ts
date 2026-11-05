import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const q = vi.hoisted(() => ({ scheduleBusinessRemoval: vi.fn() }));
vi.mock("@/lib/queries/billing", () => q);
const ws = vi.hoisted(() => ({
  row: { stripe_customer_id: "cus_example_1", stripe_subscription_id: "sub_example_1" } as Record<
    string,
    string | null
  >,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: ws.row, error: null }) }) }) }),
  }),
}));
const billing = vi.hoisted(() => ({
  scheduleRemoval: vi.fn(),
  updateQuantity: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}));
vi.mock("@/lib/stripe/billing", async (real) => ({ ...(await real<object>()), ...billing }));

const { removeBusinessAtPeriodEnd, addBusinessSeat, openPortal, startCheckout } = await import("@/lib/stripe/service");

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example_only");
  calls.length = 0;
  ws.row = { stripe_customer_id: "cus_example_1", stripe_subscription_id: "sub_example_1" };
  billing.scheduleRemoval
    .mockReset()
    .mockImplementation(async () => (calls.push("stripe schedule"), { periodEnd: 1767225600, nextQuantity: 1 }));
  q.scheduleBusinessRemoval.mockReset().mockImplementation(async () => void calls.push("db schedule"));
});
afterEach(() => vi.unstubAllEnvs());

describe("billing service", () => {
  it("removal: the Stripe schedule first, then schedule_business_removal at the period end (ISO)", async () => {
    expect(await removeBusinessAtPeriodEnd("ws-example-1", "biz-example-2")).toBe("2026-01-01T00:00:00.000Z");
    expect(calls).toEqual(["stripe schedule", "db schedule"]);
    expect(q.scheduleBusinessRemoval).toHaveBeenCalledWith(
      expect.anything(),
      "biz-example-2",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("a failing Stripe schedule leaves the DB untouched", async () => {
    billing.scheduleRemoval.mockRejectedValue(new Error("stripe down"));
    await expect(removeBusinessAtPeriodEnd("ws-example-1", "biz-example-2")).rejects.toThrow("stripe down");
    expect(q.scheduleBusinessRemoval).not.toHaveBeenCalled();
  });

  it("without a subscription: add and remove refuse (checkout first); portal needs a customer", async () => {
    ws.row = { stripe_customer_id: null, stripe_subscription_id: null };
    await expect(addBusinessSeat("ws-example-1")).rejects.toThrow(/use checkout/);
    await expect(removeBusinessAtPeriodEnd("ws-example-1", "b")).rejects.toThrow(/no subscription/);
    await expect(openPortal("ws-example-1", "https://rank1.us/app/billing")).rejects.toThrow(/use checkout/);
  });

  it("checkout reuses the stored customer", async () => {
    billing.createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/c/pay/cs_example");
    await startCheckout("ws-example-1", 2, {
      success: "https://rank1.us/app/billing?ok=1",
      cancel: "https://rank1.us/app/billing",
    });
    expect(billing.createCheckoutSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspaceId: "ws-example-1", customerId: "cus_example_1", quantity: 2 }),
    );
  });

  it("refuses a live key before any Stripe call", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_example");
    await expect(openPortal("ws-example-1", "https://rank1.us/app/billing")).rejects.toThrow(/live keys are refused/);
    expect(billing.createPortalSession).not.toHaveBeenCalled();
  });
});
