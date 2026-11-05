import { beforeEach, describe, expect, it, vi } from "vitest";

// Lead (#74 review): the server never starts a second Checkout for a workspace with a live subscription.
const state = vi.fn();
const startCheckout = vi.fn(async () => "https://checkout.stripe.test/s");
const addBusinessSeat = vi.fn(async () => 2);
const openPortal = vi.fn(async () => "https://billing.stripe.test/p");
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn(), get: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/queries/billing", () => ({ getBillingState: () => state(), listMyBusinesses: async () => [] }));
vi.mock("@/lib/stripe/service", () => ({
  startCheckout: (...a: unknown[]) => startCheckout(...(a as [])),
  addBusinessSeat: (...a: unknown[]) => addBusinessSeat(...(a as [])),
  openPortal: (...a: unknown[]) => openPortal(...(a as [])),
  removeBusinessAtPeriodEnd: vi.fn(),
}));

const billing = (status: string | null) => ({
  workspaceId: "w1",
  status,
  seats: status ? 1 : 0,
  activeCount: 1,
  hasCustomer: Boolean(status),
  nextInvoiceAt: null,
  scheduledRemovals: [],
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rank1.test");
  startCheckout.mockClear();
  addBusinessSeat.mockClear();
  openPortal.mockClear();
});

describe("billing server actions", () => {
  it.each([null, "canceled"])("no subscription (%s): Checkout", async (status) => {
    state.mockResolvedValue(billing(status));
    const { checkoutAction, addBusinessAction } = await import("@/app/app/billing/actions");
    await expect(checkoutAction()).rejects.toThrow("REDIRECT https://checkout.stripe.test/s");
    await expect(addBusinessAction()).rejects.toThrow("REDIRECT https://checkout.stripe.test/s");
    expect(startCheckout).toHaveBeenCalledTimes(2);
    expect(addBusinessSeat).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused"])(
    "live subscription (%s): never Checkout; Add raises the seat; Start goes to the portal",
    async (status) => {
      state.mockResolvedValue(billing(status));
      const { checkoutAction, addBusinessAction } = await import("@/app/app/billing/actions");
      await expect(checkoutAction()).rejects.toThrow("REDIRECT https://billing.stripe.test/p");
      expect(await addBusinessAction()).toBeUndefined();
      expect(startCheckout).not.toHaveBeenCalled();
      expect(addBusinessSeat).toHaveBeenCalledTimes(1);
    },
  );
});
