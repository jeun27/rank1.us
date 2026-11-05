import type { ReactNode } from "react";

export const container = "mx-auto max-w-page px-5 md:px-8";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`${container} scroll-mt-4 py-16 md:py-24`}>
      <h2 id={`${id}-title`} className="mb-8 font-display text-h2 font-semibold md:text-h2-md">
        {title}
      </h2>
      {children}
    </section>
  );
}
