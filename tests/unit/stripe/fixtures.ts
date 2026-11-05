import Stripe from "stripe";

// Synthetic Stripe-shaped objects: Example ids only, no customer emails or names.
export const TEST_WEBHOOK_SECRET = "whsec_test_example_only_0000000000";
export const signer = new Stripe("sk_test_example_only", {
  apiVersion: "2026-10-28.endive" as Stripe.LatestApiVersion,
});

export const sub = (p: { status?: string; quantity?: number; schedule?: string | null } = {}) => ({
  id: "sub_example_1",
  object: "subscription",
  customer: "cus_example_1",
  status: p.status ?? "active",
  schedule: p.schedule ?? null,
  items: {
    object: "list",
    data: [
      {
        id: "si_example_1",
        object: "subscription_item",
        quantity: p.quantity ?? 2,
        current_period_end: 1767225600,
        price: { id: "price_example_99", object: "price" },
      },
    ],
  },
});

export const event = (type: string, object: unknown, p: { id?: string; created?: number } = {}) => ({
  id: p.id ?? "evt_example_1",
  object: "event",
  type,
  created: p.created ?? 1764547200,
  api_version: "2026-10-28.endive",
  data: { object },
});

export function signed(payload: unknown, opts: { secret?: string; timestamp?: number } = {}) {
  const body = JSON.stringify(payload);
  const header = signer.webhooks.generateTestHeaderString({
    payload: body,
    secret: opts.secret ?? TEST_WEBHOOK_SECRET,
    ...(opts.timestamp ? { timestamp: opts.timestamp } : {}),
  });
  return { body, header };
}
