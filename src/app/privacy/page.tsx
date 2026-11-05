import type { Metadata } from "next";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { LegalPlaceholder } from "@/components/contact/LegalPlaceholder";

export const metadata: Metadata = { title: "Privacy - Rank1" };

const link =
  "text-jellyDeep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

// Placeholder copy (exempt from COPY.md): only the topics in the step 2 brief.
export default function PrivacyPage() {
  return (
    <LegalPlaceholder title="Privacy">
      <p>This is a plain-language placeholder. It is not final and is waiting for legal review.</p>
      <section>
        <h2>Google sign-in</h2>
        <p>When you sign in with Google, Rank1 receives your Google account email and name.</p>
      </section>
      <section>
        <h2>Google Analytics (GA4)</h2>
        <p>
          If you link GA4, Rank1 asks for read-only access (the analytics.readonly scope). It is used only to show
          AI-referred traffic in your reports.
        </p>
      </section>
      <section>
        <h2>Deleting your data</h2>
        <p>
          You can ask us to delete your data through the <ContactUsLink className={link}>Contact us</ContactUsLink>{" "}
          form.
        </p>
      </section>
      <section>
        <h2>Processors</h2>
        <p>Rank1 uses these services to run:</p>
        <ul>
          <li>Supabase (database and sign-in)</li>
          <li>Stripe (payments)</li>
          <li>Resend (email)</li>
          <li>Cloudflare Turnstile (spam protection on forms)</li>
          <li>Vercel (hosting)</li>
        </ul>
      </section>
    </LegalPlaceholder>
  );
}
