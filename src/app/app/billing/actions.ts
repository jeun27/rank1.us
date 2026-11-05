"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBillingState, listMyBusinesses, scheduleBusinessRemoval } from "@/lib/queries/billing";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BUSINESS_COOKIE } from "../current";
import { createCheckoutSession, createPortalSession, scheduleRemoval, updateQuantity } from "./stripe";

const PAID = new Set(["active", "trialing", "past_due", "unpaid"]);

// The workspace comes from the session, never the browser. Stripe redirects happen outside try, since
// redirect() throws by design.
async function state() {
  const db = await createClient();
  return { db, billing: await getBillingState(db) };
}

async function goToCheckout(workspaceId: string, quantity: number) {
  let url: string;
  try {
    ({ url } = await createCheckoutSession({ workspaceId, quantity: Math.max(1, quantity) }));
  } catch {
    return { error: "checkout" };
  }
  redirect(url);
}

export async function checkoutAction() {
  const { billing } = await state();
  if (!billing) return { error: "no_workspace" };
  return goToCheckout(billing.workspaceId, billing.activeCount);
}

export async function portalAction() {
  const { billing } = await state();
  if (!billing?.hasCustomer) return { error: "no_customer" };
  let url: string;
  try {
    ({ url } = await createPortalSession({ workspaceId: billing.workspaceId }));
  } catch {
    return { error: "portal" };
  }
  redirect(url);
}

// +1 seat with Stripe's default proration (lead), or Checkout for an unpaid workspace. The webhook raises
// seats_quantity; the switcher polls seatsAction until it does.
export async function addBusinessAction() {
  const { billing } = await state();
  if (!billing) return { error: "no_workspace" };
  if (!billing.status || !PAID.has(billing.status)) return goToCheckout(billing.workspaceId, billing.activeCount + 1);
  try {
    await updateQuantity({ workspaceId: billing.workspaceId, quantity: billing.seats + 1 });
  } catch {
    return { error: "add" };
  }
}

export async function seatsAction(): Promise<number> {
  return (await state()).billing?.seats ?? 0;
}

// Quantity -1 at period end; the business is archived then and its data stays read-only.
export async function removeBusinessAction(businessId: string) {
  const { db, billing } = await state();
  if (!billing || !(await listMyBusinesses(db)).some((b) => b.id === businessId)) return { error: "not_found" };
  try {
    const { archiveAt } = await scheduleRemoval({ workspaceId: billing.workspaceId, businessId });
    await scheduleBusinessRemoval(createServiceClient(), businessId, archiveAt);
  } catch {
    return { error: "remove" };
  }
  revalidatePath("/app", "layout");
}

// A business with a removal scheduled stays selectable until it is archived at period end.
export async function selectBusinessAction(businessId: string) {
  const db = await createClient();
  if (!(await listMyBusinesses(db)).some((b) => b.id === businessId)) return { error: "not_found" };
  (await cookies()).set(BUSINESS_COOKIE, businessId, {
    path: "/app",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/app", "layout");
}
