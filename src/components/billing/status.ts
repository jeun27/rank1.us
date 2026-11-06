import type { SubscriptionStatus } from "@/lib/queries/billing";

// The only statuses that may start a Checkout: no live Stripe subscription (incomplete_expired is terminal,
// like canceled). Every other status goes to the Customer Portal or a seat change, since a Checkout would
// create a second subscription (lead, #74/#79). Shared by BillingView and the billing server actions.
export const NO_SUBSCRIPTION: ReadonlySet<SubscriptionStatus | null> = new Set([
  null,
  "canceled",
  "incomplete_expired",
]);
