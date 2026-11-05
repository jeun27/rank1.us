import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

// Routing target until its own step builds the screen. Dashboard empty state copy from docs/COPY.md.
export const dashboardEmpty = {
  message: "Nothing tracked yet. Add your domain and I'll find the questions.",
  field: { label: "Your domain", placeholder: "yoursite.com", buttonLabel: "Add my business" },
};

export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-16">
      <h1 className="mb-8 font-display text-display font-semibold">{title}</h1>
      {children ?? <EmptyState {...dashboardEmpty} />}
    </main>
  );
}
