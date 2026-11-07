import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatAge } from "@/components/ui/Freshness";
import { formatPercent } from "@/components/ui/StatNumber";
import type { Vertical } from "@/lib/queries/onboarding";
import type { BusinessFreeAudit } from "@/lib/queries/results";
import { familyOf } from "@/lib/questions/templates";
import { appCopy } from "./copy";

// Onboarding v2, O1 (founder-approved P2): README §6 Q9 and §8 Q5b (the locked lines).
const copy = {
  fromAudit: "From your free audit",
  measured: "API-measured, directional",
  titleData: "See who AI names instead of you, and how to change it",
  titleNone: "Find out who AI names instead of you",
  lead: "Your first weekly check runs after you start your plan. This is what it will show.",
  values: [
    "Checks across ChatGPT, Gemini, Google AI Overview and Perplexity every week",
    "Your competitors ranked, with how many answers name each",
    "What to fix next, in order, with the answers it affects",
  ],
  sample: "See a sample report",
  lockedData: "The cards below are examples, not your data.",
  lockedNone: "Everything below is an example, not your data.",
  sr: "Locked behind the plan: your competitor ranking, per-engine results and your fix list.",
  exampleData: "Example data",
};

// OC10: three Example boards, picked by the business type. Invented names, never the owner's.
type Board = { question: string; rows: [string, number][]; fixes: string[] };
const BOARDS: Record<"restaurant" | "local" | "online", Board> = {
  restaurant: {
    question: "best ramen in Irvine",
    rows: [
      ["Example Izakaya", 70],
      ["Example Ramen House", 55],
      ["Example Udon House", 50],
      ["Example Pho Spot", 38],
    ],
    fixes: ["Add your menu to your Business Profile", "Answer the top review questions", "List your hours on Yelp"],
  },
  local: {
    question: "best plumber in Irvine",
    rows: [
      ["Example Rooter Co", 64],
      ["Example Plumbing Co", 41],
      ["Example Drain Pros", 37],
      ["Example Pipe Works", 22],
    ],
    fixes: [
      "Let AI search crawlers read your site",
      "Add your services to your Business Profile",
      "Get listed on the sites AI cites most",
    ],
  },
  online: {
    question: "best analytics tool for small teams",
    rows: [
      ["Example Metrics", 72],
      ["Example Analytics", 48],
      ["Example Dashboards", 39],
      ["Example Insights", 25],
    ],
    fixes: ["Publish a comparison page", "Add pricing to your site", "Get reviewed on the sites AI cites most"],
  },
};
const boardOf = (v: Vertical | null | undefined) => {
  const f = familyOf(v ?? undefined);
  return BOARDS[f === "restaurant" ? "restaurant" : f === "local" ? "local" : "online"];
};
const N = 160;

// UI4 (O1, README §3 + §10): the unpaid Dashboard. The real headline only when BE2 found the business's own
// free audit (same domain AND the owner's email). The pitch and the Example cards sit in the grid flow (OC8);
// card headers and "Example data" badges stay outside the blur, and only the bodies blur, aria-hidden + inert
// (OC9). The blur is never their real data, which would still be in the DOM.
export function LockedPreview({
  vertical,
  audit,
  now,
}: {
  vertical: Vertical | null | undefined;
  audit: BusinessFreeAudit | null;
  now: Date;
}) {
  const board = boardOf(vertical);
  const titleId = useId();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {audit && (
        <section aria-label={copy.fromAudit} className="rounded-surface border border-border bg-white p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-ui font-medium text-ink">{copy.fromAudit}</p>
            {audit.checkedAt && (
              <p className="text-caption text-text2">{`${appCopy.checked} ${formatAge(new Date(audit.checkedAt), now)} ago`}</p>
            )}
          </div>
          <p data-computed className="mt-2 font-display text-hero font-semibold tabular-nums">
            {formatPercent({
              value: audit.n ? audit.named / audit.n : null,
              numerator: audit.named,
              denominator: audit.n,
            })}
          </p>
          <p data-computed className="text-caption text-text2 tabular-nums">
            {`named in ${audit.named} of ${audit.n} answers · ${copy.measured}`}
          </p>
        </section>
      )}
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-4 rounded-surface border border-border bg-white p-4 md:col-span-2 md:flex-row md:items-center md:justify-between md:p-5"
      >
        <div className="flex flex-col gap-3">
          {!audit && <p className="text-caption text-text2">{copy.lead}</p>}
          <h2 id={titleId} className="font-display text-section font-medium text-ink">
            {audit ? copy.titleData : copy.titleNone}
          </h2>
          <p className="sr-only">{copy.sr}</p>
          <ul className="flex flex-col gap-2">
            {copy.values.map((v) => (
              <li key={v} className="flex items-center gap-2.5 text-ui text-text2">
                <Icon name="check" className="size-4 shrink-0 text-moss" />
                {v}
              </li>
            ))}
          </ul>
          <p className="text-caption text-inkMuted">{audit ? copy.lockedData : copy.lockedNone}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <Button href="/app/billing">{appCopy.startPaid}</Button>
          <Link
            href="/#screenshots"
            className="text-ui font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {copy.sample}
          </Link>
        </div>
      </section>
      <ExampleCard title={appCopy.competitors}>
        <p className="mb-2 text-caption text-text2">
          <span className="font-mono">{board.question}</span>
        </p>
        <ol>
          {board.rows.map(([name, named], i) => (
            <li
              key={name}
              className={`flex items-center justify-between border-b border-border px-2 py-2.5 text-ui ${i === 1 ? "bg-infoBg" : ""}`}
            >
              <span>{name}</span>
              <span className="font-mono tabular-nums">
                {formatPercent({ value: named / N, numerator: named, denominator: N })}{" "}
                <span className="text-inkMuted">{`${named} of ${N}`}</span>
              </span>
            </li>
          ))}
        </ol>
      </ExampleCard>
      <ExampleCard title={appCopy.fixNext}>
        <ol className="flex flex-col">
          {board.fixes.map((t) => (
            <li key={t} className="flex gap-3 border-b border-border py-3 text-ui">
              <span className="mt-0.5 size-4 shrink-0 rounded-full border border-fieldBorder" />
              {t}
            </li>
          ))}
        </ol>
      </ExampleCard>
    </div>
  );
}

function ExampleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-surface border border-border bg-white p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-ui font-medium text-ink">{title}</p>
        <Badge tone="info">{copy.exampleData}</Badge>
      </div>
      {/* Example only, and still blurred: the shape shows, the words don't (and never their data). */}
      <div data-blurred aria-hidden="true" inert className="pointer-events-none blur-[3px] select-none">
        {children}
      </div>
    </div>
  );
}
