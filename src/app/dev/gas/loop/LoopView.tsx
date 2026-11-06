"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { BUSINESS, PILLARS, type PillarKey } from "../data";
import type { Query } from "../params";
import { Panel, PillarTag, Proto, Status, Tag, TextAction } from "../ui";

type Step = { key: string; label: string; who: "Client" | "Rank1" | "Team"; href: string; body: () => ReactNode };

const STEPS: Step[] = [
  { key: "audit", label: "Free audit", who: "Client", href: "/dev/gas/ai-access?state=blocked", body: () => <Audit /> },
  {
    key: "connect",
    label: "Connect",
    who: "Client",
    href: "/dev/gas/ready?state=client-waiting",
    body: () => <Connect />,
  },
  {
    key: "ready",
    label: "Ready for GAS",
    who: "Rank1",
    href: "/dev/gas/ready?state=team-notice",
    body: () => <Ready />,
  },
  { key: "fixes", label: "Work the fixes", who: "Team", href: "/dev/gas/fixes?view=team", body: () => <Fixes /> },
  { key: "score", label: "Score moves", who: "Rank1", href: "/dev/app", body: () => <Score /> },
  {
    key: "report",
    label: "Report proves it",
    who: "Rank1",
    href: "/dev/app?state=report-success",
    body: () => <Report />,
  },
];
const WHO_TONE = { Client: "info", Rank1: "neutral", Team: "success" } as const;

export function LoopView({ q }: { q: Query }) {
  const i = Math.max(
    0,
    STEPS.findIndex((s) => s.key === q.step),
  );
  const step = STEPS[i];
  return (
    <Proto
      title="The GAS loop"
      intro={`What "GAS up a client" means end to end, for ${BUSINESS.name}. Each step links to its full prototype.`}
    >
      <nav aria-label="Loop steps" className="relative -mx-1 overflow-x-auto">
        <ol className="flex gap-1 px-1">
          {STEPS.map((s, n) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={`/dev/gas/loop?step=${s.key}`}
                scroll={false}
                aria-current={n === i ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-control border px-3 text-caption md:min-h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
                  n === i
                    ? "border-borderStrong bg-overlay text-ink"
                    : n < i
                      ? "border-border text-text2 hover:bg-raised"
                      : "border-border text-inkMuted hover:bg-raised"
                }`}
              >
                <span className="font-mono">{n + 1}</span>
                {s.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-inkMuted">{`${i + 1}/${STEPS.length}`}</span>
            {step.label}
          </span>
        }
        aside={<Tag tone={WHO_TONE[step.who]}>{step.who}</Tag>}
      >
        {step.body()}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <TextAction href={step.href}>Open the full prototype</TextAction>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="alt" href={`/dev/gas/loop?step=${STEPS[i - 1].key}`}>
                Back
              </Button>
            )}
            {i < STEPS.length - 1 ? (
              <Button href={`/dev/gas/loop?step=${STEPS[i + 1].key}`}>{`Next: ${STEPS[i + 1].label}`}</Button>
            ) : (
              <Button href="/dev/gas/loop?step=audit">Start again</Button>
            )}
          </div>
        </div>
      </Panel>
    </Proto>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="text-caption text-text2">{children}</p>;

function Audit() {
  return (
    <div className="flex flex-col gap-3">
      <P>
        The owner types their domain on rank1.us. The same day they get visibility, rivals, sources and the AI access
        check.
      </P>
      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="Visibility" value="18%" sub="45 of 250 answers" />
        <Kpi label="Top rival" value="41%" sub="Example Noodle Bar" />
        <div className="flex flex-col gap-1 rounded-card border border-border bg-raised p-3">
          <span className="text-caption text-inkMuted">Can AI see your site?</span>
          <Status tone="error">2 of 4 AI crawlers are blocked</Status>
        </div>
      </div>
    </div>
  );
}

function Connect() {
  return (
    <div className="flex flex-col gap-3">
      <P>
        They pick their industry and click Connect on each Recommended tile. Google&apos;s own sign-in, no passwords.
      </P>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border text-caption">
        <li className="flex items-center justify-between px-3 py-2.5">
          Google Business Profile <Status tone="success">Connected</Status>
        </li>
        <li className="flex items-center justify-between px-3 py-2.5">
          Search Console <Status tone="muted">Not connected</Status>
        </li>
      </ul>
    </div>
  );
}

function Ready() {
  return (
    <div className="flex flex-col gap-3">
      <P>The last Recommended connection lands. The client sees one calm card; the team gets one notice.</P>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-card border border-border bg-raised p-3 text-caption">
          <span className="mb-1 block text-inkMuted">Client sees</span>
          You&apos;re all set. We&apos;ll take it from here.
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-moss/30 bg-successBg p-3 text-caption">
          <span className="text-inkMuted">Team sees</span>
          <span className="flex items-center gap-2">
            {BUSINESS.name} <Tag tone="success">Ready for GAS</Tag>
          </span>
        </div>
      </div>
    </div>
  );
}

function Fixes() {
  const rows: [PillarKey, number][] = [
    ["P5", 2],
    ["P3", 2],
    ["P2", 1],
    ["P1", 1],
  ];
  return (
    <div className="flex flex-col gap-3">
      <P>
        The team works the fix list pillar by pillar, blockers first. Every edit is a diff, a confirm, then the change
        log.
      </P>
      <ol className="flex flex-col gap-1.5">
        {rows.map(([p, n]) => (
          <li
            key={p}
            className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2 text-caption"
          >
            <span className="flex items-center gap-2">
              <PillarTag pillar={p} />
              {PILLARS[p].label}
            </span>
            <span className="text-inkMuted">
              <span className="font-mono tabular-nums">{n}</span> to do
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Score() {
  // Example weekly visibility (%): the business vs the competitor average.
  const you = [18, 18, 20, 22, 23, 26, 29, 31];
  const avg = [34, 35, 33, 34, 35, 34, 35, 34];
  const x = (n: number) => 8 + n * 44;
  const y = (v: number) => 110 - v * 2.4;
  const path = (s: number[]) => s.map((v, n) => `${n ? "L" : "M"}${x(n)},${y(v)}`).join(" ");
  return (
    <div className="flex flex-col gap-3">
      <P>Rank1 asks the same questions every Monday. The score moves, with the sample size every time.</P>
      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="8 weeks ago" value="18%" sub="45 of 250 answers" />
        <Kpi label="This week" value="31%" sub="78 of 250 answers" />
        <Kpi label="Change" value="+13 pts" sub="API-measured, directional" />
      </div>
      <figure className="flex flex-col gap-1">
        <svg
          viewBox="0 0 340 120"
          role="img"
          aria-label="Visibility over 8 weeks: you from 18% to 31%, competitor average about 34%"
          className="h-32 w-full max-w-xl"
        >
          <path
            d={path(avg)}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.6"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="text-ink"
          />
          <path d={path(you)} fill="none" stroke="var(--color-accent)" strokeWidth="2.25" />
          <text x={x(7) - 2} y={y(31) - 6} textAnchor="end" className="fill-jellyDeep font-mono text-[10.5px]">
            You 31%
          </text>
          <text x={x(0)} y={y(34) - 6} className="fill-inkMuted font-mono text-[10.5px]">
            Rival avg 34%
          </text>
        </svg>
        <figcaption className="text-caption text-inkMuted">Weekly checks, Example data.</figcaption>
      </figure>
    </div>
  );
}

function Report() {
  return (
    <div className="flex flex-col gap-3">
      <P>On the 1st, the white-label report shows what moved and why, so the client sees the money.</P>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border text-caption">
        <li className="flex flex-wrap justify-between gap-2 px-3 py-2.5">
          AI visibility <span className="font-mono tabular-nums">31% · +13 pts</span>
        </li>
        <li className="flex flex-wrap justify-between gap-2 px-3 py-2.5">
          <span className="flex items-center gap-2">
            What we fixed <PillarTag pillar="P5" />
            <PillarTag pillar="P3" />
          </span>
          <span>
            <span className="font-mono tabular-nums">6</span> done this month
          </span>
        </li>
        <li className="flex flex-wrap justify-between gap-2 px-3 py-2.5">
          <span className="flex items-center gap-2">
            Visits from AI answers <PillarTag pillar="P6" />
          </span>
          <span className="font-mono tabular-nums">41</span>
        </li>
      </ul>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-raised p-3">
      <span className="text-caption text-inkMuted">{label}</span>
      <span className="font-mono text-[22px] leading-7 font-medium tracking-[-0.03em] tabular-nums">{value}</span>
      <span className="text-caption text-text2">{sub}</span>
    </div>
  );
}
