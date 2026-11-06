"use client";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import type { FixItem, FixStatus } from "@/lib/queries/fixes";
import { fixCopy as c } from "./copy";

// The customer-facing fields only: never why_note, evidence JSON, size or data_source.
export type FixView = Pick<FixItem, "id" | "rule_key" | "title" | "detail" | "affected_answers" | "status">;
type OnStatus = (id: string, status: FixStatus) => Promise<{ error: string } | undefined | void>;

const STATUSES: FixStatus[] = ["todo", "doing", "done"];

function StatusControl({ fix, onStatus, onError }: { fix: FixView; onStatus: OnStatus; onError: () => void }) {
  const id = useId();
  const [value, setValue] = useState<FixStatus>(fix.status);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-caption font-semibold">
        {c.status}
      </label>
      <select
        id={id}
        value={value}
        onChange={async (e) => {
          const next = e.target.value as FixStatus;
          const before = value;
          setValue(next);
          const r = await onStatus(fix.id, next).catch(() => ({ error: "failed" }));
          if (r && "error" in r) {
            setValue(before);
            onError();
          }
        }}
        className="h-11 rounded-control border border-fieldBorder bg-white px-2 text-ui md:h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {c.statuses[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

// level: ranked cards sit under the page H1 (h2); Tidy-ups cards under its heading (h3). One deeper inside a document (team workspace).
function FixCard({
  fix,
  canWrite,
  onStatus,
  onError,
  level,
}: {
  fix: FixView;
  canWrite: boolean;
  onStatus?: OnStatus;
  onError: () => void;
  level: 2 | 3 | 4;
}) {
  const Heading = (["h2", "h3", "h4"] as const)[level - 2];
  return (
    <li className="flex flex-col gap-3 rounded-surface bg-white p-4 shadow-card md:p-6">
      <Heading data-computed className="text-ui font-semibold">
        {fix.title}
      </Heading>
      {fix.detail && (
        <p data-computed className="text-ui">
          {fix.detail}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {fix.affected_answers !== null ? (
          <p data-computed className="text-caption text-inkMuted tabular-nums">
            {c.affected(fix.affected_answers)}
          </p>
        ) : (
          <span />
        )}
        {canWrite && onStatus ? (
          <StatusControl fix={fix} onStatus={onStatus} onError={onError} />
        ) : (
          <Badge tone="info">{c.statuses[fix.status]}</Badge>
        )}
      </div>
    </li>
  );
}

// UI.md 4b Fix list, shared by /app (self-serve), the team area and DFY clients (Steps 11/12).
export function FixList({
  ranked,
  tidyUps,
  unchecked,
  noDomain,
  canWrite,
  onStatus,
  level = 2,
}: {
  ranked: FixView[];
  tidyUps: FixView[];
  unchecked: { rule_key: string; title: string }[];
  noDomain: boolean;
  canWrite: boolean;
  onStatus?: OnStatus;
  // The heading level of the ranked cards and of "Tidy-ups": 2 on a page, 3 inside a workspace document.
  level?: 2 | 3;
}) {
  const [failed, setFailed] = useState(false);
  const onError = () => setFailed(true);
  const TidyHeading = level === 2 ? "h2" : "h3";
  if (!ranked.length && !tidyUps.length && !unchecked.length)
    return (
      <Card>
        <p className="text-body-lg">{c.empty}</p>
      </Card>
    );
  return (
    <div className="flex flex-col gap-6">
      {failed && <Banner tone="error">{c.saveFailed}</Banner>}
      {ranked.length > 0 && (
        <ul aria-label={c.title} className="flex flex-col gap-3">
          {ranked.map((f) => (
            <FixCard key={f.id} fix={f} canWrite={canWrite} onStatus={onStatus} onError={onError} level={level} />
          ))}
        </ul>
      )}
      {unchecked.length > 0 && (
        <div className="flex flex-col gap-3">
          {noDomain && <p className="text-ui">{c.noDomain}</p>}
          <ul className="flex flex-col gap-2">
            {unchecked.map((u) => (
              <li key={u.rule_key} className="flex flex-col gap-1 rounded-card border border-border bg-white px-4 py-3">
                <span data-computed className="text-ui font-semibold">
                  {u.title}
                </span>
                <span className="text-caption text-inkMuted">{c.unchecked}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tidyUps.length > 0 && (
        <section aria-label={c.tidyUps} className="flex flex-col gap-3">
          <TidyHeading className="font-display text-h3 font-semibold">{c.tidyUps}</TidyHeading>
          <ul className="flex flex-col gap-3">
            {tidyUps.map((f) => (
              <FixCard
                key={f.id}
                fix={f}
                canWrite={canWrite}
                onStatus={onStatus}
                onError={onError}
                level={level === 2 ? 3 : 4}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
