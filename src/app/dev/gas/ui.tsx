"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, type ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BUSINESS, PILLARS, type PillarKey } from "./data";

// The GAS prototype sections, in brainstorm order (G-codes from the GAS playbook).
export const SECTIONS = [
  { href: "/dev/gas/loop", code: "Loop", label: "The GAS loop" },
  { href: "/dev/gas/fixes", code: "G5", label: "Fix list by pillar" },
  { href: "/dev/gas/ai-access", code: "G2", label: "Can AI see your site?" },
  { href: "/dev/gas/ready", code: "G3", label: "Ready for GAS" },
  { href: "/dev/gas/narrative", code: "G4", label: "How AI describes you" },
  { href: "/dev/gas/youtube", code: "G1", label: "YouTube checklist" },
  { href: "/dev/gas/mentions", code: "G7", label: "Mention targets" },
] as const;

const focus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
// 44px tall below md, dense 32px at md+ (UI.md breakpoints).
export const chip = `inline-flex min-h-11 md:min-h-8 items-center gap-2 rounded-control border px-3 text-caption font-medium ${focus}`;

// One prototype page: the real v3 /app shell (rail + breadcrumb + theme toggle), one H1, the
// "Example data" tag, the section switcher and an optional state picker.
export function Proto({
  title,
  intro,
  states,
  state,
  extra,
  children,
}: {
  title: string;
  intro: ReactNode;
  states?: { key: string; label: string }[];
  state?: string;
  // More pickers (view, order) under the state picker.
  extra?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const section = SECTIONS.find((s) => s.href === path);
  return (
    <AppShell
      business={BUSINESS.name}
      actions={<ThemeToggle />}
      page={<span aria-current="page">{section?.label ?? "GAS prototypes"}</span>}
    >
      <main className="mx-auto flex w-full max-w-page min-w-0 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <nav aria-label="GAS prototypes" className="relative -mx-1 overflow-x-auto">
          <ul className="flex gap-1 px-1">
            <li className="shrink-0">
              <Link
                href="/dev/gas"
                aria-current={path === "/dev/gas" ? "page" : undefined}
                className={`${chip} border-transparent ${path === "/dev/gas" ? "bg-raised text-ink" : "text-text2 hover:bg-raised"}`}
              >
                All
              </Link>
            </li>
            {SECTIONS.map((s) => (
              <li key={s.href} className="shrink-0">
                <Link
                  href={s.href}
                  aria-current={s.href === path ? "page" : undefined}
                  className={`${chip} border-transparent ${s.href === path ? "bg-raised text-ink" : "text-text2 hover:bg-raised"}`}
                >
                  {s.code}
                  <span className="sr-only">{`: ${s.label}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-balance">{title}</h1>
            <Tag tone="info">Example data</Tag>
          </div>
          <div className="max-w-[70ch] text-caption text-text2 text-pretty">{intro}</div>
        </header>
        {states && <Picker label="State" param="state" options={states} value={state ?? states[0].key} />}
        {extra}
        {children}
      </main>
    </AppShell>
  );
}

// Link-based picker (?param=value), keeping the other params. Works without JavaScript.
export function Picker({
  label,
  param,
  options,
  value,
  keep = {},
}: {
  label: string;
  param: string;
  options: { key: string; label: string }[];
  value: string;
  keep?: Record<string, string | undefined>;
}) {
  const path = usePathname();
  const href = (v: string) => {
    const q = new URLSearchParams();
    for (const [k, x] of Object.entries(keep)) if (x) q.set(k, x);
    q.set(param, v);
    return `${path}?${q}`;
  };
  return (
    <nav aria-label={label} className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
      <span className="text-caption text-inkMuted" aria-hidden>
        {label}
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.key === value;
          return (
            <li key={o.key}>
              <Link
                href={href(o.key)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={`${chip} ${on ? "border-borderStrong bg-overlay text-ink" : "border-fieldBorder text-text2 hover:bg-raised"}`}
              >
                {on && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// v3 panel: panel fill, 1px hairline, radius 8, no shadow.
export function Panel({
  title,
  aside,
  children,
  as: As = "section",
  level = 2,
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  as?: "section" | "div" | "article";
  level?: 2 | 3;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  const id = useId();
  return (
    <As
      aria-labelledby={title ? id : undefined}
      className={`flex min-w-0 flex-col gap-3 rounded-card border border-border bg-white p-3 md:p-4 ${className}`}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && (
            <H id={id} className="text-[13px] leading-[18px] font-medium">
              {title}
            </H>
          )}
          {aside}
        </div>
      )}
      {children}
    </As>
  );
}

const tones = {
  success: "bg-successBg text-moss border-moss/25",
  error: "bg-errorBg text-brick border-brick/25",
  warn: "bg-warnBg text-warnText border-warnText/25",
  info: "bg-infoBg text-jellyDeep border-jellyDeep/25",
  neutral: "bg-raised text-text2 border-border",
};
export type Tone = keyof typeof tones;

// UI.md badge/tag: radius 4, 20h, Inter 500 11px, state fill + text + a 25% hairline.
export function Tag({ tone, children, mono }: { tone: Tone; children: ReactNode; mono?: boolean }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap ${tones[tone]} ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {children}
    </span>
  );
}

export function PillarTag({ pillar }: { pillar: PillarKey }) {
  return (
    <Tag tone="neutral">
      <span className="font-mono">{pillar}</span>
      {PILLARS[pillar].short}
    </Tag>
  );
}

// Text action: link colour, trailing arrow, 44px tap area on touch.
export function TextAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = `group inline-flex min-h-11 md:min-h-8 items-center gap-1.5 rounded-control px-1 text-caption font-medium text-jellyDeep hover:underline underline-offset-4 ${focus}`;
  const body = (
    <>
      {children}
      <Icon
        name="arrowRight"
        className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

// State dot + word. The word carries the meaning; the colour only repeats it.
export function Status({ tone, children }: { tone: "success" | "error" | "warn" | "muted"; children: ReactNode }) {
  const dot = { success: "bg-moss", error: "bg-brick", warn: "bg-warnText", muted: "bg-inkMuted" }[tone];
  const text = { success: "text-moss", error: "text-brick", warn: "text-warnText", muted: "text-inkMuted" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-caption font-medium ${text}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

// "Proposed" marker for strings not in COPY.md yet, and design notes for the founder.
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-card border border-dashed border-borderStrong px-3 py-2 text-caption text-text2">
      <Icon name="info" className="mt-0.5 size-3.5 shrink-0 text-inkMuted" />
      <span>{children}</span>
    </p>
  );
}

// Skeleton blocks (UI.md 4b Loading), inside the section instead of a whole page.
export function Blocks({ n = 3, label }: { n?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-20 animate-pulse rounded-card border border-border bg-white motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

// Checked-at caption with the clock icon (the Freshness pattern, for checks that aren't answer counts).
export function Checked({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-caption text-inkMuted tabular-nums">
      <Icon name="clock" className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
