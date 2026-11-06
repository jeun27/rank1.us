"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBillingState, listMyBusinesses } from "@/lib/queries/billing";
import { addBusinessSeat, openPortal, removeBusinessAtPeriodEnd, startCheckout } from "@/lib/stripe/service";
import { createClient } from "@/lib/supabase/server";
import { NO_SUBSCRIPTION } from "@/components/billing/status";
import { BUSINESS_COOKIE } from "../current";

// The caller's own client: data-pipeline's helpers find the workspace from it (RLS). Stripe redirects
// happen outside try, since redirect() throws by design. Errors return codes only (nothing logged).
const back = () => {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return `${site.replace(/\/$/, "")}/app/billing`;
};

async function goToCheckout(quantity: number) {
  let url: string;
  try {
    const db = await createClient();
    url = await startCheckout(db, Math.max(1, quantity), { success: back(), cancel: back() });
  } catch {
    return { error: "checkout" };
  }
  redirect(url);
}

export async function checkoutAction() {
  const billing = await getBillingState(await createClient());
  if (!billing) return { error: "no_workspace" };
  if (!NO_SUBSCRIPTION.has(billing.status)) return portalAction();
  return goToCheckout(billing.activeCount);
}

export async function portalAction() {
  let url: string;
  try {
    url = await openPortal(await createClient(), back());
  } catch {
    return { error: "portal" };
  }
  redirect(url);
}

// +1 seat with Stripe's default proration (lead), or Checkout for an unpaid workspace. The webhook raises
// seats_quantity; the switcher polls seatsAction until it does.
export async function addBusinessAction() {
  const db = await createClient();
  const billing = await getBillingState(db);
  if (!billing) return { error: "no_workspace" };
  if (NO_SUBSCRIPTION.has(billing.status)) return goToCheckout(billing.activeCount + 1);
  try {
    await addBusinessSeat(db);
  } catch {
    return { error: "add" };
  }
}

export async function seatsAction(): Promise<number> {
  return (await getBillingState(await createClient()))?.seats ?? 0;
}

// Quantity −1 at period end; the business is archived then and its data stays read-only.
export async function removeBusinessAction(businessId: string) {
  try {
    await removeBusinessAtPeriodEnd(await createClient(), businessId);
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
