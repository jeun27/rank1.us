"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { appCopy as c } from "./copy";

// Only pages that exist (lead). v3 (D14): grouped like the mockup's rail.
export const NAV_GROUPS: { href: string; label: string; icon: IconName }[][] = [
  [{ href: "/app", label: c.dashboard, icon: "dashboard" }],
  [
    { href: "/app/competitors", label: c.competitors, icon: "users" },
    { href: "/app/questions", label: c.questions, icon: "question" },
    { href: "/app/sources", label: c.sources, icon: "link" },
  ],
  [
    { href: "/app/fixes", label: c.fixNext, icon: "wrench" },
    { href: "/app/report", label: c.reports, icon: "file" },
    { href: "/app/history", label: c.history, icon: "history" },
  ],
  [{ href: "/app/billing", label: c.billing, icon: "card" }],
];

// Settings → Connections, in the last group only while ENABLE_CONNECTIONS is on (the layout passes it).
export const SETTINGS_ITEM = { href: "/app/settings", label: c.settings, icon: "settings" as IconName };

export const isCurrent = (path: string, href: string) =>
  href === "/app" ? path === "/app" : path === href || path.startsWith(`${href}/`);

// The rail: a header (logo), the page links (hidden while onboarding) and a footer (Account), all in the
// App nav landmark. A column at md+, a sideways-scrolling row on phones.
export function AppNav({
  header,
  footer,
  settings = false,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  settings?: boolean;
}) {
  const groups = settings ? [...NAV_GROUPS.slice(0, -1), [...NAV_GROUPS.at(-1)!, SETTINGS_ITEM]] : NAV_GROUPS;
  const path = usePathname();
  const onboarding = path.startsWith("/app/onboarding");
  return (
    <nav aria-label={c.nav} className="flex min-w-0 flex-1 items-center md:flex-col md:items-stretch">
      {header}
      {!onboarding && (
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-2 md:flex-none md:flex-col md:gap-0 md:overflow-visible md:py-1">
          {groups.map((group, i) => (
            <ul
              key={i}
              className={`flex shrink-0 gap-1 md:flex-col md:gap-0.5 ${i ? "md:mt-2 md:border-t md:border-border md:pt-2" : ""}`}
            >
              {group.map((item) => {
                const on = isCurrent(path, item.href);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-11 items-center gap-2.5 rounded-control px-2.5 text-ui md:h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
                        on ? "bg-raised text-ink" : "text-text2 hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <Icon name={item.icon} className={`size-4 ${on ? "text-accent" : "text-inkMuted"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}
      {footer}
    </nav>
  );
}

// The current page's nav label, for the breadcrumb.
export function CurrentPage() {
  const path = usePathname();
  const item = [...NAV_GROUPS.flat(), SETTINGS_ITEM].find((i) => isCurrent(path, i.href));
  return item ? <span aria-current="page">{item.label}</span> : null;
}
