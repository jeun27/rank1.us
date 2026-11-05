import type { Metadata } from "next";
import { connection } from "next/server";
import { BillingView, type BillingStatus } from "@/components/billing/BillingView";
import { getBillingState } from "@/lib/queries/billing";
import { createClient } from "@/lib/supabase/server";
import { checkoutAction, portalAction } from "./actions";

export const metadata: Metadata = { title: "Billing - Rank1", robots: { index: false } };

// UI.md 4b Billing. State is the webhook's (stored on the workspace), never the Checkout success URL.
export default async function BillingPage() {
  await connection();
  const billing = await getBillingState(await createClient());
  const status: BillingStatus = billing?.status ?? null;
  return (
    <BillingView
      billing={{ status, seats: billing?.seats ?? 0, nextInvoiceAt: billing?.nextInvoiceAt ?? null }}
      actions={{ checkout: checkoutAction, portal: portalAction }}
    />
  );
}
