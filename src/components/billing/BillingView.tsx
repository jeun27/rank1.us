"use client";
import { useState } from "react";
import { Page } from "@/components/app/Page";
import { PricingCard } from "@/components/site/Pricing";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { SubscriptionStatus } from "@/lib/queries/billing";
import { billingCopy as c } from "./copy";

export type BillingStatus = SubscriptionStatus | null;
// Only these may start a Checkout (lead, #74): any other status has a subscription, and a Checkout would
// create a second one. Those go to the Customer Portal.
export const NO_SUBSCRIPTION: ReadonlySet<BillingStatus> = new Set([null, "canceled"]);
export type BillingState = { status: BillingStatus; seats: number; nextInvoiceAt: string | null };
type Open = () => Promise<{ error: string } | undefined | void>;

// UI.md 4b Billing. Both actions redirect to Stripe (Checkout / Customer Portal); they only return on failure.
export function BillingView({
  billing,
  actions,
}: {
  billing: BillingState;
  actions: { checkout: Open; portal: Open };
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [failed, setFailed] = useState(false);
  const go = (which: "checkout" | "portal") => async () => {
    setBusy(which);
    setFailed(false);
    const r = await actions[which]().catch(() => ({ error: "failed" }));
    if (r && "error" in r) {
      setBusy(null);
      setFailed(true);
    }
  };
  const { status } = billing;
  const subscribed = !NO_SUBSCRIPTION.has(status);
  // incomplete(_expired): the first payment failed or needs action; past_due/unpaid: a renewal failed.
  const paymentFailed =
    status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired";

  return (
    <Page title={c.title}>
      {failed && <Banner tone="error">{c.openFailed}</Banner>}
      {paymentFailed && (
        <Banner tone="error" action={{ label: c.updateCard, onClick: go("portal") }}>
          {c.failed}
        </Banner>
      )}
      {!subscribed ? (
        <PricingCard>
          <Button onClick={go("checkout")} loading={busy === "checkout"} disabled={busy !== null}>
            {c.start}
          </Button>
        </PricingCard>
      ) : (
        <Card>
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 text-caption font-semibold text-inkMuted">
              {c.plan}
              {paymentFailed && <Badge tone="warn">{c.pastDue}</Badge>}
              {status === "paused" && <Badge tone="warn">{c.paused}</Badge>}
            </p>
            <p data-computed className="font-display text-h3 font-semibold tabular-nums">
              {c.planLine(billing.seats)}
            </p>
            {billing.nextInvoiceAt && (
              <p data-computed className="text-ui tabular-nums">
                {c.nextInvoice(billing.nextInvoiceAt)}
              </p>
            )}
            <Button onClick={go("portal")} loading={busy === "portal"} disabled={busy !== null}>
              {c.manage}
            </Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
