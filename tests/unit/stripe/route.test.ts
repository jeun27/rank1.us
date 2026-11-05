import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_WEBHOOK_SECRET, event, signed, sub } from "./fixtures";

const q = vi.hoisted(() => ({ applyStripeSubscription: vi.fn(), recordStripeEvent: vi.fn() }));
vi.mock("@/lib/queries/billing", () => q);
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));

const { POST } = await import("@/app/api/stripe/webhook/route");
const post = (body: string, sig?: string) =>
  POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body,
      headers: sig ? { "stripe-signature": sig } : {},
    }),
  );

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
  q.applyStripeSubscription.mockReset().mockResolvedValue("applied");
  q.recordStripeEvent.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/stripe/webhook", () => {
  it("verifies the raw body and applies a subscription event", async () => {
    const { body, header } = signed(event("customer.subscription.updated", sub({ quantity: 2 })));
    const res = await post(body, header);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: "applied" });
    expect(q.applyStripeSubscription).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ subscription_id: "sub_example_1", quantity: 2, status: "active" }),
    );
  });

  it("a bad or missing signature → 400, nothing applied", async () => {
    const { body } = signed(event("customer.subscription.updated", sub()));
    expect((await post(body, "t=1,v1=deadbeef")).status).toBe(400);
    expect((await post(body)).status).toBe(400);
    expect(q.applyStripeSubscription).not.toHaveBeenCalled();
  });

  it("refuses to run with a live key (500, fixed label, nothing verified or applied)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_example");
    const { body, header } = signed(event("customer.subscription.updated", sub()));
    const res = await post(body, header);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(q.applyStripeSubscription).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("stripe webhook: not configured (live key refused)");
  });

  it("a missing webhook secret → 500 not_configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { body, header } = signed(event("invoice.paid", { id: "in_example_1", object: "invoice" }));
    const res = await post(body, header);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });

  it("an RPC error → 500 apply_failed (Stripe retries); no DB text in the body", async () => {
    q.applyStripeSubscription.mockRejectedValue({
      code: "40001",
      message: "could not serialize access for cus_example_1",
    });
    const { body, header } = signed(event("customer.subscription.updated", sub()));
    const res = await post(body, header);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).toBe('{"error":"apply_failed"}');
  });
});
