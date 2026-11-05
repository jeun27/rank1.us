import "server-only";
import type { DbClient } from "@/lib/queries/client";
import { getBillingState, listMyBusinesses, scheduleBusinessRemoval } from "@/lib/queries/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { BillingError, createCheckoutSession, createPortalSession, scheduleRemoval, updateQuantity } from "./billing";
import { stripeClient } from "./client";

// Server actions pass the caller's own client: the workspace comes from getBillingState(callerDb) and a
// business must be in listMyBusinesses(callerDb) (RLS), so nobody can act on another tenant. Stripe ids
// are read with the service client and never reach the browser.
async function callerWorkspace(callerDb: DbClient): Promise<string> {
  const state = await getBillingState(callerDb);
  if (!state) throw new BillingError("billing: no workspace for this user");
  return state.workspaceId;
}
async function ids(svc: DbClient, workspaceId: string) {
  const { data, error } = await svc
    .from("workspaces")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;
  return {
    customerId: data.stripe_customer_id as string | null,
    subscriptionId: data.stripe_subscription_id as string | null,
  };
}

export async function startCheckout(callerDb: DbClient, quantity: number, urls: { success: string; cancel: string }) {
  const workspaceId = await callerWorkspace(callerDb);
  const svc = createServiceClient();
  const { customerId } = await ids(svc, workspaceId);
  return createCheckoutSession(stripeClient(), {
    workspaceId,
    customerId,
    quantity,
    successUrl: urls.success,
    cancelUrl: urls.cancel,
  });
}

// +1 business now. Seats rise when the webhook applies the new quantity; then the user goes to onboarding.
export async function addBusinessSeat(callerDb: DbClient) {
  const { subscriptionId } = await ids(createServiceClient(), await callerWorkspace(callerDb));
  if (!subscriptionId) throw new BillingError("stripe: no subscription yet (use checkout)");
  return updateQuantity(stripeClient(), subscriptionId, 1);
}

// −1 business at period end: the Stripe schedule first, then schedule_business_removal at that time.
export async function removeBusinessAtPeriodEnd(callerDb: DbClient, businessId: string) {
  const workspaceId = await callerWorkspace(callerDb);
  // Ownership first: before any Stripe call or schedule_business_removal.
  if (!(await listMyBusinesses(callerDb)).some((b) => b.id === businessId))
    throw new BillingError("billing: not your business");
  const svc = createServiceClient();
  const { subscriptionId } = await ids(svc, workspaceId);
  if (!subscriptionId) throw new BillingError("stripe: no subscription");
  const { periodEnd } = await scheduleRemoval(stripeClient(), subscriptionId);
  const at = new Date(periodEnd * 1000).toISOString();
  await scheduleBusinessRemoval(svc, businessId, at);
  return at;
}

export async function openPortal(callerDb: DbClient, returnUrl: string) {
  const { customerId } = await ids(createServiceClient(), await callerWorkspace(callerDb));
  if (!customerId) throw new BillingError("stripe: no customer yet (use checkout)");
  return createPortalSession(stripeClient(), customerId, returnUrl);
}
