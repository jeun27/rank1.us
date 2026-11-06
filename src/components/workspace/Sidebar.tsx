"use client";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/AppHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { authCopy } from "@/lib/auth/copy";
import { SECTIONS, SECTION_LABEL, type Section } from "@/lib/workspace/context";
import type { Tab } from "./DocPane";

export const SECTION_ICON: Record<Section, IconName> = {
  dashboard: "dashboard",
  questions: "question",
  competitors: "users",
  sources: "link",
  fixes: "wrench",
  experiments: "flask",
  reports: "file",
  history: "history",
  settings: "settings",
};

// Only pages with real data (lead, Step 11): Experiments, Reports and Settings come with Steps 15–17.
const LATER = new Set<Section>(["experiments", "reports", "settings"]);
export const NAV_SECTIONS = SECTIONS.filter((s) => !LATER.has(s));

const focus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
const row = `flex min-h-11 w-full items-center gap-3 rounded-card px-3 text-left text-caption font-semibold ${focus}`;
const iconButton = `grid size-11 place-items-center rounded-card text-inkMuted hover:bg-raised hover:text-ink ${focus}`;

export function Sidebar(props: {
  section: Section;
  onNav: (s: Section) => void;
  mode: "workspace" | "analytics";
  onMode: (m: "workspace" | "analytics") => void;
  recents: Tab[];
  onRecent: (t: Tab) => void;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const { section, collapsed } = props;
  // Rail (icons only) when collapsed, and always between md and lg. Full width on phones.
  const label = collapsed ? "md:sr-only" : "md:max-lg:sr-only";
  const wide = collapsed ? "md:hidden" : "md:max-lg:hidden";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-2 py-3 md:px-1.5 lg:px-2">
      {/* v3 D20: the client is in the breadcrumb; the rail starts with the logo, as on /app. */}
      <Link href="/" aria-label="Rank1" className={`flex min-h-11 items-center px-2.5 ${focus}`}>
        <Logo wordmarkClassName={label} />
      </Link>

      <div className={`grid grid-cols-2 gap-1 rounded-card bg-raised p-1 ${wide}`}>
        {(["workspace", "analytics"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={props.mode === m}
            onClick={() => props.onMode(m)}
            className={`min-h-11 rounded-[6px] text-caption font-semibold ${focus} ${
              props.mode === m ? "bg-paper text-ink" : "text-inkMuted hover:text-ink"
            }`}
          >
            {m === "workspace" ? "Workspace" : "Analytics"}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-0.5">
        {NAV_SECTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              aria-current={section === s ? "page" : undefined}
              onClick={() => props.onNav(s)}
              className={`${row} ${section === s ? "bg-raised text-ink" : "text-inkMuted hover:bg-raised hover:text-ink"}`}
            >
              <Icon name={SECTION_ICON[s]} className="size-4" />
              <span className={label}>{SECTION_LABEL[s]}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={`min-h-0 flex-1 overflow-y-auto ${wide}`}>
        <h2 className="px-3 pb-1 text-caption text-inkMuted">Recents</h2>
        <ul className="flex flex-col gap-0.5">
          {props.recents.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => props.onRecent(t)}
                className={`${row} font-normal text-ink hover:bg-raised`}
              >
                <Icon name="file" className="size-4 text-amber" />
                <span data-computed className="truncate">
                  {t.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto">
        <AccountMenu
          summary={
            <>
              <Icon name="user" className="size-4 shrink-0" />
              <span className={label}>{authCopy.account}</span>
            </>
          }
          summaryClassName={`${row} cursor-pointer list-none text-inkMuted hover:bg-raised hover:text-ink`}
          popupClassName="bottom-full left-0 mb-1"
        />
      </div>
      <div className={`flex items-center justify-between gap-1 ${collapsed ? "md:flex-col" : "md:max-lg:flex-col"}`}>
        <Link href="/contact" aria-label="Help" className={iconButton}>
          <Icon name="help" className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="Collapse sidebar"
          aria-expanded={!collapsed}
          aria-controls="ws-nav"
          onClick={props.onCollapse}
          className={`${iconButton} max-lg:hidden`}
        >
          <Icon name="panelLeft" className="size-4" />
        </button>
      </div>
    </div>
  );
}
