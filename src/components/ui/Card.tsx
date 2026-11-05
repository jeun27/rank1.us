import type { ReactNode } from "react";

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={["bg-white rounded-surface shadow-card p-4 md:p-6", className].filter(Boolean).join(" ")}>
      {title && <h3 className="mb-4 font-display text-h3 font-semibold">{title}</h3>}
      {children}
    </section>
  );
}
