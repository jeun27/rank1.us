import Link from "next/link";
import type { ReactNode } from "react";
import { navLink } from "@/components/site/Header";
import { Logo } from "@/components/ui/Logo";
import { authCopy as c } from "@/lib/auth/copy";

// Signed-in header for /app and /client: logo home link + the Account menu.
export function AppHeader() {
  return (
    <header className="mx-auto flex max-w-page items-center justify-between px-5 py-3 md:px-8">
      <Link href="/" className={navLink} aria-label="Rank1">
        <Logo />
      </Link>
      <AccountMenu />
    </header>
  );
}

// details/summary: opens without JS. Sign out is a POST, so a prefetch can't trigger it.
export function AccountMenu({
  summary = c.account,
  summaryClassName = `${navLink} cursor-pointer list-none`,
  popupClassName = "right-0 mt-1",
}: {
  summary?: ReactNode;
  summaryClassName?: string;
  popupClassName?: string;
}) {
  return (
    <details className="relative">
      <summary className={summaryClassName}>{summary}</summary>
      <div className={`absolute z-10 min-w-40 rounded-card bg-raised p-1 shadow-card ${popupClassName}`}>
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${navLink} w-full`}>
            {c.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
