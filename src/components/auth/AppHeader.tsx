import Link from "next/link";
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
export function AccountMenu() {
  return (
    <details className="relative">
      <summary className={`${navLink} cursor-pointer list-none`}>{c.account}</summary>
      <div className="absolute right-0 z-10 mt-1 min-w-40 rounded-card bg-white p-1 shadow-card">
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${navLink} w-full`}>
            {c.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
