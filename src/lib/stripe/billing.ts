import "server-only";
import type Stripe from "stripe";

export class BillingError extends Error {}

const price = (env = process.env) => {
  const p = env.STRIPE_PRICE_ID_BUSINESS?.trim();
  if (!p) throw new BillingError("stripe: STRIPE_PRICE_ID_BUSINESS is not set");
  return p;
};

// Hosted Checkout for the $99 Price × active self-serve businesses (minimum 1). client_reference_id is the
// workspace, so the webhook can link the new customer and subscription. Returns the URL to redirect to.
export async function createCheckoutSession(
  stripe: Stripe,
  input: { workspaceId: string; customerId?: string | null; quantity: number; successUrl: string; cancelUrl: string },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price(), quantity: Math.max(1, Math.floor(input.quantity)) }],
    client_reference_id: input.workspaceId,
    ...(input.customerId ? { customer: input.customerId } : {}),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) throw new BillingError("stripe: checkout session has no url");
  return session.url;
}

const firstItem = (sub: Stripe.Subscription) => {
  const item = sub.items.data[0];
  if (!item) throw new BillingError("stripe: subscription has no items");
  return item;
};

// One more business, now, with Stripe's default proration (INTEGRATIONS.md: proration_behavior "confirm"; kept
// default). If a removal schedule is attached, both of its phases go up by one so it isn't undone.
export async function updateQuantity(stripe: Stripe, subscriptionId: string, delta = 1): Promise<number> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = firstItem(sub);
  const quantity = (item.quantity ?? 1) + delta;
  if (quantity < 1) throw new BillingError("stripe: quantity can't go below 1");
  const scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  if (scheduleId) {
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    await stripe.subscriptionSchedules.update(scheduleId, {
      phases: schedule.phases.map((ph) => ({
        start_date: ph.start_date,
        end_date: ph.end_date,
        items: ph.items.map((i) => ({
          price: typeof i.price === "string" ? i.price : i.price.id,
          quantity: (i.quantity ?? 1) + delta,
        })),
      })),
      end_behavior: "release",
    });
  } else {
    await stripe.subscriptions.update(subscriptionId, { items: [{ id: item.id, quantity }] });
  }
  return quantity;
}

// One fewer business from the next period: a Subscription Schedule (from_subscription, or the attached
// one) keeps the current phase as is until current_period_end, then a next phase with one less, then
// releases. A second removal in the same period lowers the next phase again. Returns that period end.
export async function scheduleRemoval(
  stripe: Stripe,
  subscriptionId: string,
): Promise<{ periodEnd: number; nextQuantity: number }> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = firstItem(sub);
  const priceId = typeof item.price === "string" ? item.price : item.price.id;
  const now = item.quantity ?? 1;
  const periodEnd = item.current_period_end;
  const attached = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  const schedule = attached
    ? await stripe.subscriptionSchedules.retrieve(attached)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const current =
    schedule.phases.find((ph) => ph.start_date <= Math.floor(Date.now() / 1000) && ph.end_date >= periodEnd) ??
    schedule.phases[0];
  const next = schedule.phases.find((ph) => ph.start_date >= periodEnd);
  const nextQuantity = (next?.items[0]?.quantity ?? now) - 1;
  if (nextQuantity < 1) throw new BillingError("stripe: at least one business stays on the plan");
  await stripe.subscriptionSchedules.update(schedule.id, {
    phases: [
      { start_date: current.start_date, end_date: periodEnd, items: [{ price: priceId, quantity: now }] },
      {
        start_date: periodEnd,
        items: [{ price: priceId, quantity: nextQuantity }],
        duration: { interval: "month", interval_count: 1 },
      },
    ],
    end_behavior: "release",
  });
  return { periodEnd, nextQuantity };
}

export async function createPortalSession(stripe: Stripe, customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}
