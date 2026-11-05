import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { handleStripeWebhook, type WebhookDeps } from "@/lib/stripe/webhook";
import { TEST_WEBHOOK_SECRET, event, signed, signer, sub } from "./fixtures";

const base = () => ({
  verify: (raw: string, sig: string) => signer.webhooks.constructEvent(raw, sig, TEST_WEBHOOK_SECRET),
  retrieveSubscription: vi.fn<WebhookDeps["retrieveSubscription"]>(
    async () => sub({ quantity: 3 }) as unknown as Stripe.Subscription,
  ),
  applySubscription: vi.fn<WebhookDeps["applySubscription"]>(async () => "applied"),
  recordEvent: vi.fn<WebhookDeps["recordEvent"]>(async () => "applied"),
  log: vi.fn<(l: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });
const send = (payload: unknown, d = deps(), opts?: Parameters<typeof signed>[1]) => {
  const { body, header } = signed(payload, opts);
  return handleStripeWebhook(body, header, d).then((r) => ({ r, d }));
};

describe("signature (raw body, STRIPE_WEBHOOK_SECRET)", () => {
  it("a missing signature → 400, nothing applied", async () => {
    const d = deps();
    expect(await handleStripeWebhook("{}", null, d)).toEqual({ status: 400, body: { error: "bad_signature" } });
    expect(d.applySubscription).not.toHaveBeenCalled();
  });

  it("a wrong secret, a tampered body or a stale timestamp → 400", async () => {
    const e = event("customer.subscription.updated", sub());
    expect((await send(e, deps(), { secret: "whsec_other" })).r.status).toBe(400);
    const { body, header } = signed(e);
    expect((await handleStripeWebhook(body.replace('"active"', '"canceled"'), header, deps())).status).toBe(400);
    expect((await send(e, deps(), { timestamp: Math.floor(Date.now() / 1000) - 3600 })).r.status).toBe(400);
  });
});

describe("event mapping", () => {
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])(
    "%s → apply_stripe_subscription with the item quantity and period end",
    async (type) => {
      const { r, d } = await send(
        event(type, sub({ status: type.endsWith("deleted") ? "canceled" : "past_due", quantity: 4 }), {
          id: "evt_example_9",
          created: 1764547300,
        }),
      );
      expect(r).toEqual({ status: 200, body: { received: "applied" } });
      expect(d.applySubscription).toHaveBeenCalledWith({
        event_id: "evt_example_9",
        event_type: type,
        event_created: 1764547300,
        customer_id: "cus_example_1",
        subscription_id: "sub_example_1",
        status: type.endsWith("deleted") ? "canceled" : "past_due",
        quantity: 4,
        current_period_end: 1767225600,
      });
    },
  );

  it("checkout.session.completed → retrieves the subscription and links the workspace via client_reference_id", async () => {
    const session = {
      id: "cs_example_1",
      object: "checkout.session",
      mode: "subscription",
      customer: "cus_example_1",
      subscription: "sub_example_1",
      client_reference_id: "ws-example-1",
    };
    const { r, d } = await send(event("checkout.session.completed", session));
    expect(r.status).toBe(200);
    expect(d.retrieveSubscription).toHaveBeenCalledWith("sub_example_1");
    expect(d.applySubscription.mock.calls[0][0]).toMatchObject({
      client_reference_id: "ws-example-1",
      subscription_id: "sub_example_1",
      status: "active",
      quantity: 3,
    });
  });

  it.each(["invoice.paid", "invoice.payment_failed"])(
    "%s → record only (status comes from the subscription events)",
    async (type) => {
      const { r, d } = await send(
        event(type, { id: "in_example_1", object: "invoice", customer: "cus_example_1" }, { id: "evt_example_inv" }),
      );
      expect(r).toEqual({ status: 200, body: { received: "applied" } });
      expect(d.recordEvent).toHaveBeenCalledWith("evt_example_inv", type);
      expect(d.applySubscription).not.toHaveBeenCalled();
    },
  );

  it("an unknown event → 200 ignored, nothing called", async () => {
    const { r, d } = await send(event("customer.created", { id: "cus_example_1", object: "customer" }));
    expect(r).toEqual({ status: 200, body: { received: "ignored" } });
    expect(d.applySubscription).not.toHaveBeenCalled();
    expect(d.recordEvent).not.toHaveBeenCalled();
  });
});

describe("outcomes", () => {
  it.each(["duplicate", "stale", "not_found"] as const)("%s → 200 (no retry storm), logged", async (outcome) => {
    const d = deps({ applySubscription: vi.fn(async () => outcome) });
    const { r } = await send(event("customer.subscription.updated", sub()), d);
    expect(r).toEqual({ status: 200, body: { received: outcome } });
    expect(d.log).toHaveBeenCalledWith(`stripe webhook: customer.subscription.updated evt_example_1 ${outcome}`);
  });

  it("an RPC error → 500 apply_failed so Stripe retries; the body has no DB text", async () => {
    const d = deps({
      applySubscription: vi.fn(async () =>
        Promise.reject({ code: "57014", message: "canceling statement due to timeout for cus_example_1" }),
      ),
    });
    const { r } = await send(event("customer.subscription.updated", sub()), d);
    expect(r).toEqual({ status: 500, body: { error: "apply_failed" } });
    expect(d.log).toHaveBeenCalledWith("stripe webhook: customer.subscription.updated evt_example_1 failed (57014)");
  });

  it("logs never carry the secret, a customer email or the payload", async () => {
    const d = deps();
    const customer = { ...sub(), customer_email: "owner@example.test" };
    await send(event("customer.subscription.updated", customer), d);
    await send(event("customer.subscription.updated", sub()), d, { secret: "whsec_other" });
    const all = d.log.mock.calls.flat().join("\n");
    expect(all).not.toMatch(/whsec_|owner@example\.test|"items"|sk_test/);
  });
});
