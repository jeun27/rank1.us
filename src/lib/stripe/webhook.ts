import type Stripe from "stripe";

import type { ApplyResult, StripeSubscriptionEvent, SubscriptionStatus } from "@/lib/queries/billing";

// backend's apply_stripe_subscription input (0018): one transaction that records the event, ignores
// stale snapshots and archives businesses whose scheduled removal is due.
export type SubscriptionUpdate = StripeSubscriptionEvent;
export type ApplyOutcome = ApplyResult;

export type WebhookDeps = {
  // stripe.webhooks.constructEvent with STRIPE_WEBHOOK_SECRET over the raw body; throws on a bad signature.
  verify: (rawBody: string, signature: string) => Stripe.Event;
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
  applySubscription: (p: SubscriptionUpdate) => Promise<ApplyOutcome>;
  // record_stripe_event: true when the event is new.
  recordEvent: (eventId: string, type: string) => Promise<boolean>;
  log?: (line: string) => void;
};

export type WebhookResult = { status: 200 | 400 | 500; body: Record<string, string> };

// Ack-only: status comes from the subscription events.
const RECORD_ONLY = new Set(["invoice.paid", "invoice.payment_failed"]);
const SUBSCRIPTION = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

// Stripe times are Unix seconds; the RPC takes ISO strings.
const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

function fromSubscription(event: Stripe.Event, sub: Stripe.Subscription, ref?: string | null): SubscriptionUpdate {
  const item = sub.items.data[0];
  return {
    event_id: event.id,
    event_type: event.type,
    event_created: iso(event.created)!,
    customer_id: idOf(sub.customer)!,
    subscription_id: sub.id,
    status: sub.status as SubscriptionStatus,
    quantity: item?.quantity ?? null,
    current_period_end: iso(item?.current_period_end),
    ...(ref ? { client_reference_id: ref } : {}),
  };
}

const recorded = (isNew: boolean) => (isNew ? "applied" : "duplicate");

// The webhook is the source of truth (never the success_url). Never throws; logs the event type, id and
// outcome only (no secrets, customer emails or payloads). RPC errors → 500 so Stripe retries.
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const log = deps.log ?? ((l: string) => console.error(l));
  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("no signature");
    event = deps.verify(rawBody, signature);
  } catch {
    log("stripe webhook: bad signature");
    return { status: 400, body: { error: "bad_signature" } };
  }
  try {
    let outcome: string;
    if (SUBSCRIPTION.has(event.type)) {
      outcome = await deps.applySubscription(fromSubscription(event, event.data.object as Stripe.Subscription));
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = idOf(session.subscription);
      if (session.mode !== "subscription" || !subId) outcome = recorded(await deps.recordEvent(event.id, event.type));
      else
        outcome = await deps.applySubscription(
          fromSubscription(event, await deps.retrieveSubscription(subId), session.client_reference_id),
        );
    } else if (RECORD_ONLY.has(event.type)) {
      outcome = recorded(await deps.recordEvent(event.id, event.type));
    } else {
      outcome = "ignored";
    }
    log(`stripe webhook: ${event.type} ${event.id} ${outcome}`);
    return { status: 200, body: { received: outcome } };
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "error";
    log(`stripe webhook: ${event.type} ${event.id} failed (${code})`);
    return { status: 500, body: { error: "apply_failed" } };
  }
}
