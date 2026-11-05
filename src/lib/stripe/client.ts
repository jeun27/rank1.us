import "server-only";
import Stripe from "stripe";

// Pinned so Stripe's response shapes can't change under us (stripe@23's ApiVersion).
export const STRIPE_API_VERSION = "2026-10-28.endive";

export class StripeConfigError extends Error {}

// Test mode only (Step 14): refuses a live secret or restricted key before any call or verification.
export function assertTestMode(key: string | undefined = process.env.STRIPE_SECRET_KEY): string {
  if (!key?.trim()) throw new StripeConfigError("stripe: STRIPE_SECRET_KEY is not set");
  if (/^(sk|rk)_live_/.test(key.trim())) throw new StripeConfigError("stripe: live keys are refused (test mode only)");
  return key.trim();
}

export type StripeOptions = { key?: string; httpClient?: Stripe.HttpClient };

export function stripeClient(opts: StripeOptions = {}): Stripe {
  return new Stripe(assertTestMode(opts.key ?? process.env.STRIPE_SECRET_KEY), {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    maxNetworkRetries: 1,
    ...(opts.httpClient ? { httpClient: opts.httpClient } : {}),
  });
}
