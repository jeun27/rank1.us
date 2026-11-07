"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { welcome } from "@/app/app/onboarding/copy";
import { useEffect, useRef, type ReactNode } from "react";
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
    { href: "/app/experiments", label: c.experiments, icon: "flask" },
    { href: "/app/report", label: c.reports, icon: "file" },
    { href: "/app/history", label: c.history, icon: "history" },
  ],
  [{ href: "/app/billing", label: c.billing, icon: "card" }],
];

// Settings → Connections, in the last group only while ENABLE_CONNECTIONS is on (the layout passes it).
export const SETTINGS_ITEM = { href: "/app/settings", label: c.settings, icon: "settings" as IconName };

export const isCurrent = (path: string, href: string) =>
  href === "/app" ? path === "/app" : path === href || path.startsWith(`${href}/`);

// X2: phones get these in a bottom bar (thumb zone); the rest and Account sit under "More".
const BAR = ["/app", "/app/fixes", "/app/competitors"];

// The rail: a header (logo), the page links (hidden while onboarding) and a footer (Account), all in the
// App nav landmark. A column at md+; on phones a bottom bar instead (X2).
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
      {onboarding && <SetupSteps />}
      {!onboarding && <BottomBar groups={groups} path={path} footer={footer} />}
      {!onboarding && (
        <div
          data-rail
          className="flex min-w-0 flex-1 gap-1 px-2 py-2 max-md:hidden md:flex-none md:flex-col md:gap-0 md:py-1"
        >
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
      {/* Phones reach Account under More; during onboarding (no bar) it stays in the rail row. */}
      <div
        className={
          onboarding
            ? "contents max-md:flex max-md:w-full max-md:justify-end max-md:border-b max-md:border-border max-md:bg-rail max-md:px-2"
            : "contents max-md:hidden"
        }
      >
        {footer}
      </div>
    </nav>
  );
}

// UI1 (absorbs v1 OB3): while onboarding, the rail lists the 4 setup steps (md+; phones see the step in the
// onboarding bar). Read from ?step=, which Onboarding keeps in sync. Not links: the steps go in order.
function SetupSteps() {
  const step = Math.min(4, Math.max(1, Number(useSearchParams().get("step")) || 1));
  return (
    <ol aria-label={welcome.stepsLabel} className="flex flex-col gap-0.5 px-2 py-1 max-md:hidden">
      {welcome.steps.map((label, i) => {
        const n = i + 1;
        const on = n === step;
        return (
          <li
            key={label}
            aria-current={on ? "step" : undefined}
            className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-ui ${
              on ? "bg-raised text-ink ring-1 ring-border" : n < step ? "text-ink" : "text-text2"
            }`}
          >
            <span
              className={`flex size-4.5 items-center justify-center rounded-full border font-mono text-tag ${
                on || n < step ? "border-current" : "border-inkMuted text-inkMuted"
              }`}
            >
              {n}
            </span>
            {label}
            {n < step && <span className="sr-only"> {welcome.done}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const cell =
  "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-caption font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

function BottomBar({
  groups,
  path,
  footer,
}: {
  groups: { href: string; label: string; icon: IconName }[][];
  path: string;
  footer?: ReactNode;
}) {
  const more = useRef<HTMLDetailsElement>(null);
  // A link in the sheet navigates without a reload: close the sheet on the new page.
  useEffect(() => {
    if (more.current) more.current.open = false;
  }, [path]);
  const all = groups.flat();
  const rest = all.filter((i) => !BAR.includes(i.href));
  const restOn = rest.some((i) => isCurrent(path, i.href));
  return (
    <ul
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-rail pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {BAR.map((href) => {
        const item = all.find((i) => i.href === href)!;
        const on = isCurrent(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? "page" : undefined}
              className={`${cell} ${on ? "text-ink" : "text-text2"}`}
            >
              <Icon name={item.icon} className={`size-5 ${on ? "text-accent" : "text-inkMuted"}`} />
              {item.label}
            </Link>
          </li>
        );
      })}
      <li>
        <details
          ref={more}
          className="group h-full"
          onKeyDown={(e) => {
            if (e.key !== "Escape" || !more.current?.open) return;
            more.current.open = false;
            more.current.querySelector("summary")?.focus();
          }}
        >
          <summary className={`${cell} cursor-pointer list-none ${restOn ? "text-ink" : "text-text2"}`}>
            <Icon name="more" className={`size-5 ${restOn ? "text-accent" : "text-inkMuted"}`} />
            {c.more}
          </summary>
          <div
            data-more-sheet
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto border-t border-border bg-rail p-2"
          >
            <ul className="flex flex-col">
              {rest.map((item) => {
                const on = isCurrent(path, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-11 items-center gap-2.5 rounded-control px-2.5 text-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
                        on ? "bg-raised text-ink" : "text-text2"
                      }`}
                    >
                      <Icon name={item.icon} className={`size-4 ${on ? "text-accent" : "text-inkMuted"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {footer && <div className="mt-2 border-t border-border pt-2">{footer}</div>}
          </div>
        </details>
      </li>
    </ul>
  );
}

// The current page's nav label, for the breadcrumb.
export function CurrentPage() {
  const path = usePathname();
  const item = [...NAV_GROUPS.flat(), SETTINGS_ITEM].find((i) => isCurrent(path, i.href));
  return item ? <span aria-current="page">{item.label}</span> : null;
}
