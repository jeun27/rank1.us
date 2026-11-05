import { applyStripeSubscription, recordStripeEvent } from "@/lib/queries/billing";
import { handleStripeWebhook, stripeClient } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Stripe → our state. The raw body is needed for the signature, so read req.text() before anything else.
// A live key or missing config is a 500 with a fixed label (never the reason in the body).
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  let stripe;
  try {
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    stripe = stripeClient();
  } catch (e) {
    console.error(
      `stripe webhook: not configured (${e instanceof Error && /live/.test(e.message) ? "live key refused" : "missing env"})`,
    );
    return Response.json({ error: "not_configured" }, { status: 500 });
  }
  const db = createServiceClient();
  const out = await handleStripeWebhook(raw, req.headers.get("stripe-signature"), {
    verify: (body, sig) => stripe.webhooks.constructEvent(body, sig, secret),
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    applySubscription: (p) => applyStripeSubscription(db, p),
    recordEvent: (id, type) => recordStripeEvent(db, id, type),
  });
  return Response.json(out.body, { status: out.status });
}
