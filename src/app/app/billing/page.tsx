import type { Metadata } from "next";
import { Placeholder } from "@/components/auth/Placeholder";
import { PricingCard } from "@/components/site/Pricing";
import { Button } from "@/components/ui/Button";
import { authCopy as c } from "@/lib/auth/copy";

export const metadata: Metadata = { title: "Billing - Rank1", robots: { index: false } };

// Paywall stub until Step 14 opens Stripe Checkout.
export default function BillingPage() {
  return (
    <Placeholder title="Billing">
      <PricingCard>
        <Button disabled aria-describedby="checkout-closed">
          Start for $99/mo
        </Button>
        <p id="checkout-closed" className="text-caption text-inkMuted">
          {c.checkoutClosed}
        </p>
      </PricingCard>
    </Placeholder>
  );
}
