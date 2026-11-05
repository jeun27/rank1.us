import type { ReactNode } from "react";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";

const includes = [
  "4 AI engines",
  "25 questions checked every week",
  "one dashboard",
  "competitor leaderboard",
  "white-label monthly report with GA4 link + what to fix next",
  "no 'Powered by Rank1' credit",
];

const contact = (
  <>
    <ContactUsLink>Contact us</ContactUsLink>
    {"."}
  </>
);

// The plan card, shared by the landing and the /app/billing paywall; the caller passes the buttons.
export function PricingCard({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-xl rounded-surface bg-white p-4 shadow-card md:p-6">
      <p className="font-display text-h3 font-semibold">$99/mo, self-serve, for 1 business.</p>
      <ul className="mt-4 flex list-disc flex-col gap-1 pl-5">
        {includes.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export function Pricing() {
  return (
    <Section id="pricing" title="One plan. One business.">
      <PricingCard>
        <Button href="/signin?next=/app/billing">Start for $99/mo</Button>
        <Button variant="secondary" href="#audit">
          Get my free audit first
        </Button>
      </PricingCard>
      <p className="mt-6">Agency? $99 per business, white-label included. {contact}</p>
      <p>Want us to do the work for you? {contact}</p>
    </Section>
  );
}
