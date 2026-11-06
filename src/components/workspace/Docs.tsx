"use client";
import { useEffect, useState, type ReactNode } from "react";
import { AddCompetitorForm, CompetitorSuggestions } from "@/components/app/CompetitorActions";
import { appCopy } from "@/components/app/copy";
import { FixList } from "@/components/fixes/FixList";
import { MentionsSection } from "@/components/mentions/MentionsSection";
import { narrativeCopy } from "@/components/narrative/copy";
import { NarrativeSettings } from "@/components/narrative/NarrativeSettings";
import { Badge } from "@/components/ui/Badge";
import { Freshness } from "@/components/ui/Freshness";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatNumber, VisibilityCell } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import { ENGINES, ENGINE_LABEL, type WorkspaceView } from "@/lib/queries/workspace";
import {
  EMPTY,
  SECTIONS,
  SECTION_LABEL,
  contextFor,
  fallbackNote,
  formatDate,
  linksText,
  namedText,
  pointsChange,
  pointsDelta,
  type Selection,
} from "@/lib/workspace/context";
import type { DocSel } from "./DocPane";
import { NAV_SECTIONS, SECTION_ICON } from "./Sidebar";
import { ClientsPanel } from "./ClientsPanel";
import { TeamConnections } from "./TeamConnections";
import { deltaTone, signedPts } from "@/lib/metrics/delta";
import { useTeam, type TeamExtras } from "./team";
import { ClientQueue } from "./ClientQueue";

const D = ({ children }: { children: ReactNode }) => <span data-computed>{children}</span>;

function Doc({
  title,
  children,
  view,
  now,
}: {
  title: string;
  children: ReactNode;
  view: WorkspaceView;
  now: Date | null;
}) {
  return (
    <article className="flex max-w-prose flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 data-computed className="text-h3 font-semibold">
          {title}
        </h2>
        <p data-computed className="text-caption text-inkMuted">
          {view.business.name}
        </p>
        {now && view.latest.checkedAt && (
          <div data-computed>
            <Freshness checkedAt={view.latest.checkedAt} answers={view.latest.answers} now={now} />
          </div>
        )}
      </div>
      {children}
    </article>
  );
}

const H = ({ children }: { children: string }) => <h3 className="text-ui font-semibold">{children}</h3>;

function Summary({ view }: { view: WorkspaceView }) {
  const change = pointsDelta(view.latest.visibility, view.checks[1]?.visibility);
  return (
    <>
      <div className="flex items-end gap-4" data-computed>
        <StatNumber metric={view.latest.visibility} />
        {change !== null && (
          <Badge tone={deltaTone(change)} mono>
            {signedPts(change)}
          </Badge>
        )}
      </div>
      <Table
        caption="Engine"
        columns={[
          { key: "e", header: "Engine" },
          { key: "n", header: "Named", numeric: true },
        ]}
        rows={ENGINES.map((e) => ({ e: ENGINE_LABEL[e], n: <D>{namedText(view.latest.byEngine[e])}</D> }))}
      />
      <Leaderboard view={view} top={5} />
    </>
  );
}

function Leaderboard({ view, top }: { view: WorkspaceView; top?: number }) {
  return (
    <Table
      caption="Competitors"
      columns={[
        { key: "b", header: "Business" },
        { key: "n", header: "Named", numeric: true },
      ]}
      rows={view.competitors.slice(0, top).map((c) => ({
        b: (
          <span className="flex items-center gap-2">
            <D>{c.name}</D>
            {c.you && <Badge tone="info">You</Badge>}
          </span>
        ),
        n: <VisibilityCell metric={c.named} />,
      }))}
    />
  );
}

// Team writes for the selected client (existing RPCs; RLS decides).
function CompetitorTools({ team }: { team: TeamExtras }) {
  const actions = {
    add: (c: Parameters<TeamExtras["actions"]["add"]>[1]) => team.actions.add(team.businessId, c),
    dismiss: (c: Parameters<TeamExtras["actions"]["dismiss"]>[1]) => team.actions.dismiss(team.businessId, c),
  };
  const [suggestions, setSuggestions] = useState<LocalCompetitor[]>([]);
  const { businessId, loadSuggestions } = team;
  useEffect(() => {
    let live = true;
    loadSuggestions(businessId).then(
      (items) => live && setSuggestions(items),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [businessId, loadSuggestions]);
  return (
    <>
      {suggestions.length > 0 && (
        <section aria-label={appCopy.suggested} className="flex flex-col gap-3">
          <H>{appCopy.suggested}</H>
          <CompetitorSuggestions suggestions={suggestions} actions={actions} />
        </section>
      )}
      <AddCompetitorForm add={actions.add} />
    </>
  );
}

// C-c: the Connections document of the selected DFY client (team only, ENABLE_CONNECTIONS).
function ConnectionsDoc({
  view,
  now,
  onPick,
}: {
  view: WorkspaceView;
  now: Date | null;
  onPick: (s: Selection) => void;
}) {
  const team = useTeam();
  if (!team?.connections) return null;
  const { businessId: b, actions: a } = team;
  return (
    <Doc title="Connections" view={view} now={now}>
      <TeamConnections
        key={b}
        data={team.connections}
        now={now ?? new Date()}
        onDismiss={async () => a.dismissReady?.(b)}
        onStartFixes={() => onPick({ kind: "section", section: "fixes" })}
        gbpEdit={
          a.previewGbp && a.applyGbp
            ? {
                preview: (loc, e) => a.previewGbp!(b, loc, e),
                apply: (loc, e, changes) => a.applyGbp!(b, loc, e, changes),
              }
            : undefined
        }
      />
    </Doc>
  );
}

// C-c D3: "How AI describes {Business}" for the selected DFY client (team only, ENABLE_NARRATIVE). The editor
// keeps the client's own labels ("Words that fit you"): they're the client's words.
function NarrativeDoc({ view, now }: { view: WorkspaceView; now: Date | null }) {
  const team = useTeam();
  if (!team?.narrative || !team.actions.saveNarrative) return null;
  const { businessId: b, actions: a } = team;
  return (
    <Doc title={narrativeCopy.teamTitle(view.business.name)} view={view} now={now}>
      <NarrativeSettings key={b} view={team.narrative} save={(w) => a.saveNarrative!(b, w)} />
    </Doc>
  );
}

// Step 12: the Clients tab of the selected DFY client (team only).
function ClientsDoc({ view, now }: { view: WorkspaceView; now: Date | null }) {
  const team = useTeam();
  if (!team?.clients) return null;
  const { businessId: b, actions: a } = team;
  return (
    <Doc title="Clients" view={view} now={now}>
      {team.queue && team.queue.length > 0 && <ClientQueue rows={team.queue} formAction={team.formAction} />}
      <ClientsPanel
        key={b}
        users={team.clients.users}
        fixListVisible={team.clients.fixListVisible}
        actions={{
          invite: (email) => a.invite(b, email),
          remove: (userId) => a.removeClient(b, userId),
          setVisible: (v) => a.setFixListVisible(b, v),
        }}
      />
    </Doc>
  );
}

const Empty = ({ message }: { message: string }) => <EmptyState message={message} />;

function SectionDoc({
  view,
  section,
  onPick,
}: {
  view: WorkspaceView;
  section: (typeof SECTIONS)[number];
  onPick: (s: Selection) => void;
}) {
  const team = useTeam();
  switch (section) {
    case "dashboard":
    case "reports":
      return (
        <>
          {section === "reports" && <p className="text-ui">{EMPTY.reports}</p>}
          <Summary view={view} />
        </>
      );
    case "questions":
      return (
        <Table
          caption="Questions"
          columns={[
            { key: "q", header: "Question" },
            { key: "n", header: "Named", numeric: true },
          ]}
          rows={view.questions.map((q) => ({
            q: (
              <button
                type="button"
                onClick={() => onPick({ kind: "question", id: q.id })}
                className="min-h-11 text-left text-caption text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
              >
                <D>{q.text}</D>
              </button>
            ),
            n: <D>{namedText(q.visibility)}</D>,
          }))}
        />
      );
    case "competitors":
      return (
        <>
          <Leaderboard view={view} />
          {team && <CompetitorTools team={team} />}
        </>
      );
    case "fixes":
      return team ? (
        <FixList
          {...team.fixes}
          level={3}
          canWrite
          onStatus={(id, status) => team.actions.status(team.businessId, id, status)}
        />
      ) : (
        <Empty message={EMPTY.fixes!} />
      );
    case "sources":
      return (
        <>
          {team?.mentions && team.actions.decideMention && (
            <MentionsSection
              key={team.businessId}
              targets={team.mentions.targets}
              canDecide
              fixId={team.mentions.fixId}
              decide={(url, status) => team.actions.decideMention!(team.businessId, url, status)}
              level={3}
              onView={() => onPick({ kind: "section", section: "fixes" })}
            />
          )}
          <Table
            caption="Sources"
            columns={[
              { key: "e", header: "Engine" },
              { key: "n", header: "Sources", numeric: true },
            ]}
            rows={ENGINES.map((e) => ({ e: ENGINE_LABEL[e], n: <D>{linksText(view.sources.byEngine[e])}</D> }))}
          />
          <ul className="flex flex-col divide-y divide-border border-y border-border text-caption">
            {view.sources.domains.map((d) => (
              <li key={d.domain} className="flex justify-between gap-4 py-2">
                <D>{d.domain}</D>
                <D>{linksText(d.links)}</D>
              </li>
            ))}
          </ul>
        </>
      );
    case "history":
      return (
        <Table
          caption="History"
          columns={[
            { key: "d", header: "Checked" },
            { key: "v", header: "Visibility", numeric: true },
            { key: "c", header: "Change", numeric: true },
          ]}
          rows={view.checks.map((c, i) => ({
            d: (
              <span className="flex flex-wrap items-center gap-2">
                <D>{formatDate(c.finishedAt)}</D>
                {c.partial && (
                  <Badge tone="warn">
                    <D>{`${c.ok} of ${c.total} answers`}</D>
                  </Badge>
                )}
              </span>
            ),
            v: <VisibilityCell metric={c.visibility} />,
            c: <D>{pointsChange(c.visibility, view.checks[i + 1]?.visibility) ?? "–"}</D>,
          }))}
        />
      );
    case "settings":
      return <Facts view={view} sel={{ kind: "section", section }} />;
    default:
      return <Empty message={EMPTY[section]!} />;
  }
}

function Facts({ view, sel }: { view: WorkspaceView; sel: Selection }) {
  return (
    <dl className="flex flex-col gap-2 text-ui">
      {contextFor(view, sel).facts.map((f) => (
        <div key={f.label} className="flex flex-wrap justify-between gap-x-4 border-b border-border py-2">
          <dt data-computed className="text-inkMuted">
            {f.label}
          </dt>
          <dd data-computed className="tabular-nums">
            {f.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QuestionDoc({ view, id }: { view: WorkspaceView; id: string }) {
  const q = view.questions.find((x) => x.id === id)!;
  const links = q.answers.flatMap((a) => a.citations.map((c) => ({ ...c, engine: a.engine })));
  return (
    <>
      <Facts view={view} sel={{ kind: "question", id }} />
      <Table
        caption="Named"
        columns={[
          { key: "e", header: "Engine" },
          { key: "n", header: "Named" },
        ]}
        rows={q.answers.map((a) => ({
          e: (
            <span
              className={a.fallbackCountry ? "text-inkMuted" : ""}
              title={a.fallbackCountry ? fallbackNote(ENGINE_LABEL[a.engine]) : undefined}
            >
              <D>{`${ENGINE_LABEL[a.engine]} ${a.runIndex}`}</D>
            </span>
          ),
          n: <D>{a.status === "ok" ? a.brands.join(", ") : "–"}</D>,
        }))}
      />
      <H>Sources</H>
      {links.length ? (
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-caption text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
              >
                <Icon name="link" className="size-4" />
                <D>{`${l.domain} · ${ENGINE_LABEL[l.engine]}`}</D>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p data-computed className="text-caption text-inkMuted">
          {linksText(0)}
        </p>
      )}
    </>
  );
}

function DomainDoc({ view, domain }: { view: WorkspaceView; domain: string }) {
  const rows = view.questions
    .map((q) => ({ q, n: q.answers.reduce((s, a) => s + a.citations.filter((c) => c.domain === domain).length, 0) }))
    .filter((r) => r.n > 0);
  return (
    <>
      <Facts view={view} sel={{ kind: "domain", domain }} />
      <Table
        caption="Question"
        columns={[
          { key: "q", header: "Question" },
          { key: "n", header: "Sources", numeric: true },
        ]}
        rows={rows.map((r) => ({ q: <D>{r.q.text}</D>, n: <D>{linksText(r.n)}</D> }))}
      />
    </>
  );
}

function NewTab({ onPick }: { onPick: (s: Selection) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {NAV_SECTIONS.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onPick({ kind: "section", section: s })}
            className="flex min-h-11 w-full items-center gap-3 rounded-card border border-border px-3 text-left text-caption font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-jellyDeep"
          >
            <Icon name={SECTION_ICON[s]} className="size-4 text-inkMuted" />
            {SECTION_LABEL[s]}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DocView({
  view,
  sel,
  now,
  onPick,
}: {
  view: WorkspaceView;
  sel: DocSel;
  now: Date | null;
  onPick: (s: Selection) => void;
}) {
  if (sel.kind === "new") return <NewTab onPick={onPick} />;
  if (sel.kind === "clients") return <ClientsDoc view={view} now={now} />;
  if (sel.kind === "connections") return <ConnectionsDoc view={view} now={now} onPick={onPick} />;
  if (sel.kind === "narrative") return <NarrativeDoc view={view} now={now} />;
  const title = contextFor(view, sel).title;
  return (
    <Doc title={title} view={view} now={now}>
      {sel.kind === "section" ? (
        <SectionDoc view={view} section={sel.section} onPick={onPick} />
      ) : sel.kind === "question" ? (
        <QuestionDoc view={view} id={sel.id} />
      ) : sel.kind === "domain" ? (
        <DomainDoc view={view} domain={sel.domain} />
      ) : (
        <Facts view={view} sel={sel} />
      )}
    </Doc>
  );
}
