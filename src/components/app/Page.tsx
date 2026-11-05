import type { ReactNode } from "react";
import { Freshness } from "@/components/ui/Freshness";

// One H1 per app page, full width (lead: nav + full-width, not 3-pane).
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
      <h1 className="font-display text-h2 font-semibold md:text-h2-md">{title}</h1>
      {children}
    </main>
  );
}

export const Section = ({ title, children, label }: { title: string; children: ReactNode; label?: string }) => (
  <section aria-label={label} className="flex flex-col gap-3">
    <h2 className="font-display text-h3 font-semibold">{title}</h2>
    {children}
  </section>
);

// PRODUCT.md rule 3: results show n + freshness and the "API-measured, directional" label.
// Without a single check time (a list of runs), the label alone.
export function Measured({ checkedAt, answers, now }: { checkedAt: string | null; answers?: number; now?: Date }) {
  if (checkedAt && answers !== undefined && now)
    return (
      <div data-computed>
        <Freshness checkedAt={checkedAt} answers={answers} now={now} />
      </div>
    );
  return <p className="text-caption text-inkMuted">API-measured, directional</p>;
}
