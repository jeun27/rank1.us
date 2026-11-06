import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/AppHeader";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AppNav, CurrentPage } from "./AppNav";

// D42: "Rank1 / business / page". /team passes its client switcher as the business crumb (D20).
export function Breadcrumb({ business, page }: { business: ReactNode; page: ReactNode }) {
  return (
    // One row at every width (C5): Rank1 and the page don't shrink; the business crumb gives way first and
    // ends in an ellipsis.
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      {/* "/" separators come from CSS (::before on every crumb after the first), never extra list items. */}
      <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap text-ui [&>li+li]:before:mr-2 [&>li+li]:before:text-inkMuted [&>li+li]:before:content-['/']">
        {/* Phones (X9a): the page name only. A real switcher (several businesses, /team) stays. */}
        <li className="shrink-0 text-text2 max-md:hidden">
          <Link
            href="/"
            className="inline-flex items-center hover:text-ink focus-visible:outline-2 focus-visible:outline-jellyDeep max-md:min-h-11 max-md:min-w-11"
          >
            Rank1
          </Link>
        </li>
        <li className="flex min-w-0 items-center font-medium text-ink max-md:before:hidden max-md:has-[[data-crumb-static]]:hidden">
          {typeof business === "string" ? (
            <span data-crumb-name data-crumb-static className="min-w-0 truncate">
              {business}
            </span>
          ) : (
            business
          )}
        </li>
        <li className="shrink-0 text-ink max-md:[li:has([data-crumb-static])+&]:before:hidden">{page}</li>
      </ol>
    </nav>
  );
}

// v3 /app shell (D14, D42): the dark rail (logo, grouped nav, Account) on the left at md+ and a
// sideways row on phones; a breadcrumb top bar "Rank1 / business / page" with the theme toggle on the
// right (inside Account below md, X9a).
export function AppShell({
  business,
  page,
  settings = false,
  children,
}: {
  business: ReactNode;
  // Shows Settings in the rail (ENABLE_CONNECTIONS).
  settings?: boolean;
  // The last crumb; defaults to the nav label of the current path (galleries pass their own).
  page?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div
        data-theme="dark"
        className="flex items-center border-b border-border bg-rail text-ink max-md:contents md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0"
      >
        <AppNav
          settings={settings}
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
              <AccountMenu extra={<ThemeToggle labelled />} />
            </div>
          }
        />
      </div>
      {/* X2: phones pad for the bottom bar (56px + the home-indicator inset). */}
      <div className="flex min-w-0 flex-1 flex-col max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <header className="flex min-h-12 items-center justify-between gap-x-4 border-b border-border px-4 md:px-6">
          <Breadcrumb business={business} page={page ?? <CurrentPage />} />
          <div className="flex shrink-0 items-center gap-2 max-md:hidden">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
