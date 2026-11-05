import type { Metadata } from "next";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { LegalPlaceholder } from "@/components/contact/LegalPlaceholder";

export const metadata: Metadata = { title: "Terms - Rank1" };

const link =
  "text-jellyDeep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

// Placeholder copy (exempt from COPY.md). No legal claims until review.
export default function TermsPage() {
  return (
    <LegalPlaceholder title="Terms">
      <p>This is a plain-language placeholder. It is not final and is waiting for legal review.</p>
      <section>
        <h2>The plan</h2>
        <p>Rank1 has one plan: $99/mo per business, self-serve.</p>
      </section>
      <section>
        <h2>Results</h2>
        <p>Results are API-measured, directional.</p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Ask us anything through the <ContactUsLink className={link}>Contact us</ContactUsLink> form.
        </p>
      </section>
    </LegalPlaceholder>
  );
}
