import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

// Plain page frame for /contact, /privacy and /terms: optional notice, logo home link, then one H1.
export function SimplePage({ title, notice, children }: { title: string; notice?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header>
        {notice}
        <div className="mx-auto max-w-page px-5 pt-6 md:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-16">
        <h1 className="mb-8 font-display text-display font-semibold">{title}</h1>
        {children}
      </main>
    </>
  );
}
