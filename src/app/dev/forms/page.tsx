import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditRequestForm } from "@/components/forms/AuditRequestForm";
import { ContactUsLink } from "@/components/contact/ContactUsLink";

export const metadata: Metadata = { title: "Forms", robots: { index: false } };

// Dev gallery for the step 2 forms until the landing page hosts them. Hidden in production.
export default function DevFormsPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main>
      <h1 className="mx-auto max-w-page px-5 py-8 font-display text-display font-semibold md:px-8">Forms</h1>
      <section aria-labelledby="audit-h" className="bg-ink px-5 py-12 text-paper md:px-8">
        <div className="mx-auto max-w-page">
          <h2 id="audit-h" className="mb-6 font-display text-h2 font-semibold">
            AuditRequestForm
          </h2>
          <AuditRequestForm />
        </div>
      </section>
      <section aria-labelledby="contact-h" className="mx-auto max-w-page px-5 py-12 md:px-8">
        <h2 id="contact-h" className="mb-4 font-display text-h2 font-semibold">
          ContactUsLink
        </h2>
        <ContactUsLink>Contact us</ContactUsLink>
      </section>
    </main>
  );
}
