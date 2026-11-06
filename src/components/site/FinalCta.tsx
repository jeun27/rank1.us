import { AuditRequestForm } from "@/components/forms/AuditRequestForm";
import { Jelly } from "@/components/ui/Jelly";
import { container } from "./Section";

export function FinalCta() {
  return (
    <section id="audit" aria-labelledby="audit-title" className={`${container} scroll-mt-4 py-16 md:py-24`}>
      <div
        data-frame
        className="relative isolate flex items-center gap-8 overflow-hidden rounded-frame border border-border bg-white p-6 md:p-12"
      >
        <div
          aria-hidden="true"
          data-glow
          className="glow pointer-events-none absolute -top-24 -right-24 -z-10 size-80"
        />
        <div className="flex-1">
          <h2 id="audit-title" className="font-display text-h2 font-semibold md:text-h2-md">
            Find out if AI names your business first.
          </h2>
          <p className="mt-4 text-body-lg">
            Free same-day audit as CSV and PNG (includes a small &apos;Powered by Rank1&apos; credit).
          </p>
          <div className="mt-6">
            <AuditRequestForm />
          </div>
        </div>
        {/* Second Jelly on the page, so alt="". 96px, eyes up; hidden on mobile (D41). */}
        <Jelly size={96} decorative className="hidden h-auto w-24 shrink-0 md:block" />
      </div>
    </section>
  );
}
