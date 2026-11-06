import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/AppHeader";
import { Logo } from "@/components/ui/Logo";
import { AppNav, CurrentPage } from "./AppNav";

// D42: "Rank1 / business / page". /team passes its client switcher as the business crumb (D20).
export function Breadcrumb({ business, page }: { business: ReactNode; page: ReactNode }) {
  return (
    // One row at every width (C5): Rank1 and the page don't shrink; the business crumb gives way first and
    // ends in an ellipsis.
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      {/* "/" separators come from CSS (::before on every crumb after the first), never extra list items. */}
      <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap text-ui [&>li+li]:before:mr-2 [&>li+li]:before:text-inkMuted [&>li+li]:before:content-['/']">
        <li className="shrink-0 text-text2">
          <Link
            href="/"
            className="inline-flex items-center hover:text-ink focus-visible:outline-2 focus-visible:outline-jellyDeep max-md:min-h-11 max-md:min-w-11"
          >
            Rank1
          </Link>
        </li>
        <li className="flex min-w-0 items-center font-medium text-ink">
          {typeof business === "string" ? (
            <span data-crumb-name className="min-w-0 truncate">
              {business}
            </span>
          ) : (
            business
          )}
        </li>
        <li className="shrink-0 text-ink">{page}</li>
      </ol>
    </nav>
  );
}

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
        <header className="flex min-h-12 items-center justify-between gap-x-4 border-b border-border px-4 md:px-6">
          <Breadcrumb business={business} page={page ?? <CurrentPage />} />
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
