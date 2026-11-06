import { useId } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatAge } from "@/components/ui/Freshness";
import { Table } from "@/components/ui/Table";
import type { AiAccessCheck } from "@/lib/queries/ai-access";
import { aiAccessAnswer, aiAccessCopy as c, readableCount, SEARCH_BOTS } from "./ai-access";

const EDGE = { success: "border-moss", info: "border-jellyDeep", warn: "border-warnText", error: "border-brick" };

// G2 "Can AI see your site?" (lead OK 2026-11-06, D1): the answer first, then the evidence. On /audit below
// the leaderboard, and as the evidence inside the P5 fixes (R14, R16, R18) in What to fix next.
export function AiAccessPanel({ check, now, level = 2 }: { check: AiAccessCheck; now: Date; level?: 2 | 3 | 4 }) {
  const id = useId();
  const Heading = (["h2", "h3", "h4"] as const)[level - 2];
  const answer = aiAccessAnswer(check);
  const reached = check.outcome !== "unreachable";
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <Heading id={id} className={level === 2 ? "font-display text-h3 font-semibold" : "text-ui font-semibold"}>
        {c.title}
      </Heading>
      <p data-tone={answer.tone} className={`border-l-2 pl-3 text-ui font-medium ${EDGE[answer.tone]}`}>
        {answer.line}
      </p>
      {reached && (
        <>
          <p data-computed className="text-caption text-inkMuted">
            {c.count(readableCount(check))}
          </p>
          {answer.hint && <p className="text-ui text-text2">{answer.hint}</p>}
          {level === 2 ? (
            <Table
              caption={c.title}
              columns={[
                { key: "agent", header: c.crawler },
                { key: "access", header: c.access },
                { key: "rule", header: c.rule },
              ]}
              rows={check.crawlers.map((x) => ({
                agent: <span className="text-ui">{x.agent}</span>,
                access: <Access agent={x.agent} allowed={x.allowed} />,
                rule: <Rule line={x.line} />,
              }))}
            />
          ) : (
            // Inside a fix row the table doesn't fit a phone, so the crawlers stack (PR4's `stack` will replace this).
            <ul aria-label={c.crawler} className="flex flex-col divide-y divide-border border-y border-border">
              {check.crawlers.map((x) => (
                <li key={x.agent} className="flex flex-col gap-1 py-2">
                  <span className="flex items-center justify-between gap-2 text-ui">
                    {x.agent}
                    <Access agent={x.agent} allowed={x.allowed} />
                  </span>
                  <Rule line={x.line} />
                </li>
              ))}
            </ul>
          )}
          {check.visible_words !== null && (
            <dl className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 pb-3 text-ui">
              <dt>{c.jsOff}</dt>
              <dd data-computed className="tabular-nums">
                {c.words(check.visible_words)}
              </dd>
            </dl>
          )}
        </>
      )}
      <p className="text-caption text-inkMuted">
        <span data-computed>{c.checked(formatAge(new Date(check.checked_at), now))}</span>
        {reached && <span className="block">{c.explainer}</span>}
      </p>
    </section>
  );
}

// The /app dashboard's quiet line under the hero, only when AI can read the site. Problems are P5 fixes.
export function AiReassure({ check, now }: { check: AiAccessCheck; now: Date }) {
  if (check.outcome !== "good") return null;
  return (
    <p data-computed className="text-caption text-inkMuted">
      {c.reassure(formatAge(new Date(check.checked_at), now))}
    </p>
  );
}

function Access({ agent, allowed }: { agent: string; allowed: boolean }) {
  // A search bot's block is the error (R14); another crawler's block is the owner's call (info).
  const tone = allowed ? "success" : SEARCH_BOTS.includes(agent) ? "error" : "info";
  return (
    <Badge tone={tone} data-tone={tone}>
      {allowed ? c.allowed : c.blocked}
    </Badge>
  );
}

function Rule({ line }: { line: string | null }) {
  return line ? (
    <code className="font-mono text-caption">{line}</code>
  ) : (
    <span className="text-caption text-inkMuted">{c.noRule}</span>
  );
}
