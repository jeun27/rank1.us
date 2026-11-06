import Link from "next/link";
import type { ReactNode } from "react";
import { navLink } from "@/components/site/Header";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { authCopy as c } from "@/lib/auth/copy";

// Signed-in header for /client (and the /team placeholders): logo home link, an optional switcher, the
// "Dark theme" toggle (D40: /client themes like /app and /team, same prefs), and the Account menu.
export function AppHeader({ switcher, connections = false }: { switcher?: ReactNode; connections?: boolean }) {
  return (
    <header className="mx-auto flex max-w-page items-center justify-between gap-3 px-5 py-3 md:px-8">
      <Link href="/" className={navLink} aria-label="Rank1">
        <Logo />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        {switcher}
        {/* Settings → Connections for a DFY client (ENABLE_CONNECTIONS). */}
        {connections && (
          <Link href="/client/settings/connections" className={navLink}>
            Connections
          </Link>
        )}
        <span className="max-md:hidden">
          <ThemeToggle />
        </span>
        <AccountMenu extra={<ThemeToggle labelled />} />
      </div>
    </header>
  );
}

// details/summary: opens without JS. Sign out is a POST, so a prefetch can't trigger it.
// extra: phone-only items above Sign out (X9a: the theme toggle moves here below md).
export function AccountMenu({
  summary = c.account,
  summaryClassName = `${navLink} cursor-pointer list-none`,
  popupClassName = "right-0 mt-1",
  extra,
}: {
  summary?: ReactNode;
  summaryClassName?: string;
  popupClassName?: string;
  extra?: ReactNode;
}) {
  return (
    <details className="relative">
      <summary className={summaryClassName}>{summary}</summary>
      <div className={`absolute z-10 min-w-40 rounded-card bg-raised p-1 shadow-card ${popupClassName}`}>
        {extra && <div className="md:hidden">{extra}</div>}
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${navLink} w-full`}>
            {c.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
