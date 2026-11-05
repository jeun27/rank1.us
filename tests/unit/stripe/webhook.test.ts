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
  recordEvent: vi.fn<WebhookDeps["recordEvent"]>(async () => true),
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
      const state = sub({ status: type.endsWith("deleted") ? "canceled" : "past_due", quantity: 4 });
      const d0 = deps({ retrieveSubscription: vi.fn(async () => state as unknown as Stripe.Subscription) });
      const { r, d } = await send(event(type, state, { id: "evt_example_9", created: 1764547300 }), d0);
      expect(r).toEqual({ status: 200, body: { received: "applied" } });
      expect(d.applySubscription).toHaveBeenCalledWith({
        event_id: "evt_example_9",
        event_type: type,
        event_created: "2025-12-01T00:01:40.000Z",
        customer_id: "cus_example_1",
        subscription_id: "sub_example_1",
        status: type.endsWith("deleted") ? "canceled" : "past_due",
        quantity: 4,
        current_period_end: "2026-01-01T00:00:00.000Z",
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

  it("a repeated ack-only event → 200 duplicate", async () => {
    const d = deps({ recordEvent: vi.fn(async () => false) });
    const { r } = await send(event("invoice.paid", { id: "in_example_1", object: "invoice" }), d);
    expect(r).toEqual({ status: 200, body: { received: "duplicate" } });
  });

  it("an unknown event → 200 ignored, nothing called", async () => {
    const { r, d } = await send(event("customer.created", { id: "cus_example_1", object: "customer" }));
    expect(r).toEqual({ status: 200, body: { received: "ignored" } });
    expect(d.applySubscription).not.toHaveBeenCalled();
    expect(d.recordEvent).not.toHaveBeenCalled();
  });
});

describe("current state, not the event snapshot (review)", () => {
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])(
    "%s retrieves the subscription and applies Stripe's current state, keeping event.created",
    async (type) => {
      const d = deps({
        retrieveSubscription: vi.fn(
          async () => sub({ status: "active", quantity: 5 }) as unknown as Stripe.Subscription,
        ),
      });
      // A same-second created/updated pair: the payload still says incomplete, Stripe now says active.
      await send(
        event(type, sub({ status: "incomplete", quantity: 1 }), { id: "evt_example_s", created: 1764547300 }),
        d,
      );
      expect(d.retrieveSubscription).toHaveBeenCalledWith("sub_example_1");
      expect(d.applySubscription.mock.calls[0][0]).toMatchObject({
        status: "active",
        quantity: 5,
        event_id: "evt_example_s",
        event_created: "2025-12-01T00:01:40.000Z",
      });
    },
  );

  it("a failing retrieve → 500 so Stripe retries, nothing applied", async () => {
    const d = deps({ retrieveSubscription: vi.fn(async () => Promise.reject({ code: "rate_limit" })) });
    const { r } = await send(event("customer.subscription.updated", sub()), d);
    expect(r).toEqual({ status: 500, body: { error: "apply_failed" } });
    expect(d.applySubscription).not.toHaveBeenCalled();
  });
});

describe("outcomes", () => {
  it.each(["duplicate", "stale"] as const)("%s → 200, logged", async (outcome) => {
    const d = deps({ applySubscription: vi.fn(async () => outcome) });
    const { r } = await send(event("customer.subscription.updated", sub()), d);
    expect(r).toEqual({ status: 200, body: { received: outcome } });
    expect(d.log).toHaveBeenCalledWith(`stripe webhook: customer.subscription.updated evt_example_1 ${outcome}`);
  });

  it("not_found (the customer isn't linked yet) → 500 not_linked so Stripe retries; logged", async () => {
    const d = deps({ applySubscription: vi.fn(async () => "not_found" as const) });
    const { r } = await send(event("customer.subscription.created", sub()), d);
    expect(r).toEqual({ status: 500, body: { error: "not_linked" } });
    expect(d.log).toHaveBeenCalledWith("stripe webhook: customer.subscription.created evt_example_1 not_found");
  });

  it("ordering: the subscription event arrives first (500, retried), checkout then links it with the full state", async () => {
    const applied: string[] = [];
    const d = deps({
      applySubscription: vi.fn(async (p) => {
        if (p.client_reference_id) return (applied.push("linked"), "applied");
        return applied.includes("linked") ? "applied" : "not_found";
      }),
    });
    const early = await send(event("customer.subscription.created", sub({ quantity: 2 }), { id: "evt_example_a" }), d);
    expect(early.r.status).toBe(500);
    const session = {
      id: "cs_example_1",
      object: "checkout.session",
      mode: "subscription",
      customer: "cus_example_1",
      subscription: "sub_example_1",
      client_reference_id: "ws-example-1",
    };
    const checkout = await send(event("checkout.session.completed", session, { id: "evt_example_b" }), d);
    expect(checkout.r).toEqual({ status: 200, body: { received: "applied" } });
    // Full state from the retrieved subscription, so seats and status are right without a later event.
    expect(d.applySubscription.mock.calls[1][0]).toMatchObject({
      client_reference_id: "ws-example-1",
      status: "active",
      quantity: 3,
      current_period_end: "2026-01-01T00:00:00.000Z",
    });
    const retry = await send(event("customer.subscription.created", sub({ quantity: 2 }), { id: "evt_example_a" }), d);
    expect(retry.r).toEqual({ status: 200, body: { received: "applied" } });
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
