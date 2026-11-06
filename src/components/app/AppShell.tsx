import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/AppHeader";
import { Logo } from "@/components/ui/Logo";
import { AppNav, CurrentPage } from "./AppNav";

// v3 /app shell (D14, D42): the dark rail (logo, grouped nav, Account) on the left at md+ and a
// sideways row on phones; a breadcrumb top bar "Rank1 / business / page" with actions on the right.
export function AppShell({
  business,
  actions,
  page,
  children,
}: {
  business: ReactNode;
  actions?: ReactNode;
  // The last crumb; defaults to the nav label of the current path (galleries pass their own).
  page?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div
        data-theme="dark"
        className="flex items-center border-b border-border bg-rail text-ink md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0"
      >
        <AppNav
          header={
            <Link
              href="/"
              aria-label="Rank1"
              className="hidden h-12 shrink-0 items-center px-4 md:flex focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
            >
              <Logo />
            </Link>
          }
          footer={
            <div className="shrink-0 px-2 md:mt-auto md:border-t md:border-border md:py-2">
              <AccountMenu />
            </div>
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 md:px-6">
          <nav aria-label="Breadcrumb" className="min-w-0">
            {/* "/" separators come from CSS (::before on every crumb after the first), never extra list items. */}
            <ol className="flex min-w-0 items-center gap-2 text-ui [&>li+li]:before:mr-2 [&>li+li]:before:text-inkMuted [&>li+li]:before:content-['/']">
              <li className="text-text2">
                <Link href="/" className="hover:text-ink focus-visible:outline-2 focus-visible:outline-jellyDeep">
                  Rank1
                </Link>
              </li>
              <li className="min-w-0 font-medium text-ink">{business}</li>
              <li className="text-ink">{page ?? <CurrentPage />}</li>
            </ol>
          </nav>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
