import type { Metadata } from "next";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { LegalPlaceholder } from "@/components/contact/LegalPlaceholder";

export const metadata: Metadata = { title: "Privacy - Rank1" };

const link =
  "text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

const POLICY = "https://developers.google.com/terms/api-services-user-data-policy";

// Placeholder copy (exempt from COPY.md): only the topics in the step 2 brief. The Google user data section is
// in COPY.md (lead-approved 2026-11-07 for Google OAuth verification; founder to review); its Limited Use sentence is Google's, word
// for word.
export default function PrivacyPage() {
  return (
    <LegalPlaceholder title="Privacy" updated="2026-11-07">
      <p>This is a plain-language placeholder. It is not final and is waiting for legal review.</p>
      {/* Several paragraphs: space them like the sections' own blocks. */}
      <section className="[&>p+p]:mt-3 [&>p+ul]:mt-1 [&>ul+p]:mt-3">
        <h2>Google user data</h2>
        <p>When you sign in with Google or connect a Google service, Rank1 receives only this:</p>
        <ul>
          <li>Google sign-in: your Google account email and name.</li>
          <li>
            Google Business Profile (the business.manage scope): Rank1 reads your listing details and applies only the
            edits you approve.
          </li>
          <li>
            Google Search Console (the webmasters.readonly scope): read-only access to your site&apos;s search data.
          </li>
          <li>
            Google Analytics, GA4 (the analytics.readonly scope): read-only access, used to show AI-referred traffic in
            your reports.
          </li>
          <li>YouTube (the youtube.readonly scope): read-only access to your channel&apos;s videos.</li>
        </ul>
        <p>Rank1 uses this data only to show you your own business&apos;s visibility and fixes.</p>
        <p>
          Google access tokens are stored encrypted. You can disconnect any Google service at any time from Connections
          in Rank1, or from your{" "}
          <a href="https://myaccount.google.com/permissions" className={link}>
            Google Account permissions
          </a>
          .
        </p>
        <p>We never sell your Google data, use it for ads, or use it to train AI models.</p>
        <p>
          Rank1&apos;s use and transfer to any other app of information received from Google APIs will adhere to{" "}
          <a href={POLICY} className={link}>
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
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
