"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { ENGINE_LABEL, type Engine } from "@/components/audit/contract";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MentionTarget, MentionTargets } from "@/lib/metrics/mentions";
import { mentionsCopy as c } from "./copy";

type Status = "added" | "dismissed" | null;
export type Decide = (url: string, status: Status) => Promise<{ fixId: string | null } | { error: string }>;

const text = "text-ui text-link underline underline-offset-4";
const action =
  "inline-flex min-h-11 items-center text-ui text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

function PageLink({ t }: { t: MentionTarget }) {
  return (
    <a href={t.url} target="_blank" rel="noopener noreferrer" className={`font-medium ${text}`}>
      {t.title ?? t.domain}
    </a>
  );
}

// G7 (lead OK 2026-11-06) at the top of /app/sources: pages AI cites that name rivals but not the business.
// Decisions are optimistic; a failed save reverts the row with an inline note (role=status), never a banner.
export function MentionsSection({
  targets,
  canDecide,
  fixId: initialFix,
  decide,
}: {
  // null before the first run.
  targets: MentionTargets | null;
  canDecide: boolean;
  // The open grouped R17 fix, for "View".
  fixId: string | null;
  decide: Decide;
}) {
  const heading = useId();
  const [override, setOverride] = useState<Record<string, Status>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [fixId, setFixId] = useState(initialFix);
  const all = targets ? [...targets.candidates, ...targets.added, ...targets.dismissed] : [];
  const base = (url: string): Status =>
    targets?.added.some((t) => t.url === url)
      ? "added"
      : targets?.dismissed.some((t) => t.url === url)
        ? "dismissed"
        : null;
  const statusOf = (url: string) => (url in override ? override[url] : base(url));

  const set = async (url: string, next: Status) => {
    const prev = statusOf(url);
    setOverride((o) => ({ ...o, [url]: next }));
    setFailed((f) => ({ ...f, [url]: false }));
    const r = await decide(url, next).catch(() => ({ error: "failed" }));
    if ("error" in r) {
      setOverride((o) => ({ ...o, [url]: prev }));
      setFailed((f) => ({ ...f, [url]: true }));
    } else setFixId(r.fixId);
  };

  const row = (t: MentionTarget) => {
    const status = statusOf(t.url);
    const engines = t.engines.map((e) => ENGINE_LABEL[e as Engine] ?? e);
    return (
      <li key={t.url} data-url={t.url} className="flex flex-col gap-2 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <PageLink t={t} />
          <span className="text-caption text-inkMuted">
            {t.category} · <span className="font-mono">{t.domain}</span>
          </span>
        </div>
        <p data-computed className="text-ui">
          {c.rivalsLine(t.rivals)}
        </p>
        <p data-computed className="text-caption text-inkMuted tabular-nums">
          {c.answers(t.answers, targets!.n, engines)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {status === "added" && <Badge tone="success">{c.added}</Badge>}
          {status === "added" && fixId && (
            <Link href={`/app/fixes#fix-${fixId}`} className={action}>
              {c.view}
            </Link>
          )}
          {canDecide && status === null && (
            <>
              <Button variant="alt" onClick={() => set(t.url, "added")}>
                {c.add}
              </Button>
              <button type="button" onClick={() => set(t.url, "dismissed")} className={action}>
                {c.notRelevant}
              </button>
            </>
          )}
          {canDecide && status === "added" && (
            <button type="button" onClick={() => set(t.url, null)} className={action}>
              {c.remove}
            </button>
          )}
          {canDecide && status === "dismissed" && (
            <button type="button" onClick={() => set(t.url, null)} className={action}>
              {c.restore}
            </button>
          )}
          <p role="status" className="text-caption text-brick">
            {failed[t.url] ? c.failed : ""}
          </p>
        </div>
      </li>
    );
  };

  const open = all.filter((t) => statusOf(t.url) === null);
  const added = all.filter((t) => statusOf(t.url) === "added");
  const dismissed = all.filter((t) => statusOf(t.url) === "dismissed");
  const list = "flex flex-col divide-y divide-border border-y border-border";
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-3">
      <div>
        <h2 id={heading} className="font-display text-h3 font-semibold">
          {c.title}
        </h2>
        <p className="text-ui text-text2">{c.sub}</p>
      </div>
      {!targets ? (
        <p className="text-ui">{c.emptyFirst}</p>
      ) : !all.length ? (
        <p className="text-ui">{c.emptyNone}</p>
      ) : (
        <>
          {open.length > 0 && (
            <ul aria-label={c.title} className={list}>
              {open.map(row)}
            </ul>
          )}
          {added.length > 0 && (
            <section aria-label={c.added} className="flex flex-col gap-2">
              <h3 className="text-ui font-semibold">{c.added}</h3>
              <ul aria-label={c.added} className={list}>
                {added.map(row)}
              </ul>
            </section>
          )}
          {dismissed.length > 0 && (
            <details className="flex flex-col gap-2">
              <summary className="min-h-11 cursor-pointer text-ui font-medium md:min-h-8">
                {c.dismissedCount(dismissed.length)}
              </summary>
              <ul aria-label={c.notRelevant} className={list}>
                {dismissed.map(row)}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

// The grouped R17 fix's evidence in What to fix next (lead Q3): at most 3 added pages, then +n more.
export function MentionsEvidence({ added }: { added: MentionTarget[] }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {added.slice(0, 3).map((t) => (
          <li key={t.url} className="flex flex-col gap-0.5">
            <PageLink t={t} />
            <span data-computed className="text-caption text-inkMuted">
              {c.rivalsLine(t.rivals)}
            </span>
          </li>
        ))}
      </ul>
      {added.length > 3 && (
        <Link href="/app/sources" className={`self-start ${text}`}>
          {c.more(added.length - 3)}
        </Link>
      )}
    </div>
  );
}
