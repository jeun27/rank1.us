"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appCopy as c } from "./copy";

// Only pages that exist (lead): later steps add Report, Experiments, Settings.
const ITEMS = [
  { href: "/app", label: c.dashboard },
  { href: "/app/competitors", label: c.competitors },
  { href: "/app/questions", label: c.questions },
  { href: "/app/sources", label: c.sources },
  { href: "/app/fixes", label: c.fixNext },
  { href: "/app/report", label: c.reports },
  { href: "/app/history", label: c.history },
  { href: "/app/billing", label: c.billing },
] as const;

// Left rail at md+, a sideways-scrolling tab row on phones. Hidden while onboarding.
export function AppNav() {
  const path = usePathname();
  if (path.startsWith("/app/onboarding")) return null;
  const current = (href: string) => (href === "/app" ? path === "/app" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label={c.nav} className="border-b border-border md:w-52 md:shrink-0 md:border-r md:border-b-0">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:px-4 md:py-6">
        {ITEMS.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              aria-current={current(i.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-card px-3 text-ui font-semibold focus-visible:outline-2 focus-visible:outline-jellyDeep ${
                current(i.href) ? "bg-white text-ink shadow-card" : "text-inkMuted hover:text-ink"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
