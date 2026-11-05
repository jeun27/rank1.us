import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const q = vi.hoisted(() => ({ scheduleBusinessRemoval: vi.fn(), getBillingState: vi.fn(), listMyBusinesses: vi.fn() }));
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

const caller = {} as never;

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example_only");
  q.getBillingState.mockReset().mockResolvedValue({ workspaceId: "ws-example-1" });
  q.listMyBusinesses
    .mockReset()
    .mockResolvedValue([{ id: "biz-example-2", name: "Example Noodle Bar", archiveAt: null }]);
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
    expect(await removeBusinessAtPeriodEnd(caller, "biz-example-2")).toBe("2026-01-01T00:00:00.000Z");
    expect(calls).toEqual(["stripe schedule", "db schedule"]);
    expect(q.scheduleBusinessRemoval).toHaveBeenCalledWith(
      expect.anything(),
      "biz-example-2",
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("refuses a business outside the caller's workspace before any Stripe call or DB write (cross-tenant)", async () => {
    await expect(removeBusinessAtPeriodEnd(caller, "biz-other-tenant")).rejects.toThrow(/not your business/);
    expect(billing.scheduleRemoval).not.toHaveBeenCalled();
    expect(q.scheduleBusinessRemoval).not.toHaveBeenCalled();
  });

  it("refuses a caller without a workspace for every action", async () => {
    q.getBillingState.mockResolvedValue(null);
    await expect(removeBusinessAtPeriodEnd(caller, "biz-example-2")).rejects.toThrow(/no workspace/);
    await expect(addBusinessSeat(caller)).rejects.toThrow(/no workspace/);
    await expect(openPortal(caller, "https://rank1.us/app/billing")).rejects.toThrow(/no workspace/);
    await expect(startCheckout(caller, 1, { success: "s", cancel: "c" })).rejects.toThrow(/no workspace/);
    expect(billing.scheduleRemoval).not.toHaveBeenCalled();
  });

  it("a failing Stripe schedule leaves the DB untouched", async () => {
    billing.scheduleRemoval.mockRejectedValue(new Error("stripe down"));
    await expect(removeBusinessAtPeriodEnd(caller, "biz-example-2")).rejects.toThrow("stripe down");
    expect(q.scheduleBusinessRemoval).not.toHaveBeenCalled();
  });

  it("without a subscription: add and remove refuse (checkout first); portal needs a customer", async () => {
    ws.row = { stripe_customer_id: null, stripe_subscription_id: null };
    await expect(addBusinessSeat(caller)).rejects.toThrow(/use checkout/);
    await expect(removeBusinessAtPeriodEnd(caller, "biz-example-2")).rejects.toThrow(/no subscription/);
    await expect(openPortal(caller, "https://rank1.us/app/billing")).rejects.toThrow(/use checkout/);
  });

  it("checkout reuses the stored customer", async () => {
    billing.createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/c/pay/cs_example");
    await startCheckout(caller, 2, {
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
    await expect(openPortal(caller, "https://rank1.us/app/billing")).rejects.toThrow(/live keys are refused/);
    expect(billing.createPortalSession).not.toHaveBeenCalled();
  });
});
