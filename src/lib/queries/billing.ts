import type { Json } from "@/types/db";
import type { DbClient } from "./client";

// Stripe subscription state (Step 14). Billing fields are service-write only; members read them.

export type SubscriptionStatus =
  "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";

export type BillingState = {
  workspaceId: string;
  status: SubscriptionStatus | null;
  seats: number;
  // Active (not archived) self-serve businesses: the Stripe quantity (minimum 1 at checkout).
  activeCount: number;
  hasCustomer: boolean;
  nextInvoiceAt: string | null;
  scheduledRemovals: { businessId: string; name: string; archiveAt: string }[];
};

// The caller's workspace billing state (oldest membership), or null without a workspace.
export async function getBillingState(db: DbClient): Promise<BillingState | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: member, error } = await db
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at")
    .order("workspace_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) return null;
  const [ws, businesses] = await Promise.all([
    db
      .from("workspaces")
      .select("id, subscription_status, seats_quantity, stripe_customer_id, stripe_current_period_end")
      .eq("id", member.workspace_id)
      .single(),
    db
      .from("businesses")
      .select("id, name, archive_at")
      .eq("workspace_id", member.workspace_id)
      .eq("service", "self_serve")
      .is("archived_at", null)
      .order("created_at")
      .order("id"),
  ]);
  if (ws.error) throw ws.error;
  if (businesses.error) throw businesses.error;
  return {
    workspaceId: ws.data.id,
    status: ws.data.subscription_status as SubscriptionStatus | null,
    seats: ws.data.seats_quantity,
    activeCount: businesses.data.length,
    hasCustomer: ws.data.stripe_customer_id !== null,
    nextInvoiceAt: ws.data.stripe_current_period_end,
    scheduledRemovals: businesses.data
      .filter((b) => b.archive_at)
      .map((b) => ({ businessId: b.id, name: b.name, archiveAt: b.archive_at! })),
  };
}

export type MyBusiness = { id: string; name: string; archiveAt: string | null };

// The switcher's list: the caller's active self-serve businesses, oldest first.
export async function listMyBusinesses(db: DbClient): Promise<MyBusiness[]> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return [];
  const { data: member, error } = await db
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at")
    .order("workspace_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) return [];
  const { data, error: bizError } = await db
    .from("businesses")
    .select("id, name, archive_at")
    .eq("workspace_id", member.workspace_id)
    .eq("service", "self_serve")
    .is("archived_at", null)
    .order("created_at")
    .order("id");
  if (bizError) throw bizError;
  return data.map((b) => ({ id: b.id, name: b.name, archiveAt: b.archive_at }));
}

export type StripeSubscriptionEvent = {
  event_id: string;
  event_type: string;
  // ISO time of the Stripe event (event.created); older events than the last applied are ignored.
  event_created: string;
  customer_id: string;
  subscription_id: string | null;
  status: SubscriptionStatus;
  quantity: number | null;
  current_period_end: string | null;
  client_reference_id?: string | null;
};

export type ApplyResult = "applied" | "duplicate" | "stale" | "not_found";

// Service client only. Records the event and applies it in one transaction (idempotent by event id).
export async function applyStripeSubscription(
  serviceDb: DbClient,
  event: StripeSubscriptionEvent,
): Promise<ApplyResult> {
  const { data, error } = await serviceDb.rpc("apply_stripe_subscription", { p: event as unknown as Json });
  if (error) throw error;
  return data as ApplyResult;
}

// Service client only. Records an event we only acknowledge; true when it is new.
export async function recordStripeEvent(serviceDb: DbClient, eventId: string, type: string): Promise<boolean> {
  const { data, error } = await serviceDb.rpc("record_stripe_event", { p_event_id: eventId, p_type: type });
  if (error) throw error;
  return data;
}

// Service client only. The business is archived at `at` (the period end) by the next
// subscription event or archiveScheduledBusinesses. 22023 for a past time or a non-active/DFY business.
export async function scheduleBusinessRemoval(serviceDb: DbClient, businessId: string, at: string): Promise<void> {
  const { error } = await serviceDb.rpc("schedule_business_removal", { p_business_id: businessId, p_at: at });
  if (error) throw error;
}

export async function cancelBusinessRemoval(serviceDb: DbClient, businessId: string): Promise<void> {
  const { error } = await serviceDb.rpc("cancel_business_removal", { p_business_id: businessId });
  if (error) throw error;
}

// Service client only. Archives every due scheduled removal; returns how many.
export async function archiveScheduledBusinesses(serviceDb: DbClient): Promise<number> {
  const { data, error } = await serviceDb.rpc("archive_scheduled_businesses");
  if (error) throw error;
  return data;
}
