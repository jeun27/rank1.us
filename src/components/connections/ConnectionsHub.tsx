"use client";
import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/billing/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import type { GoogleConnector } from "@/lib/connections/oauth";
import { recommend, type Industry, type Tile } from "@/lib/connections/recommend";
import type { ConnectionEntity, ConnectionProvider, ConnectionStatus, ConnectorKey } from "@/lib/queries/connections";
import { Consent, startUrl } from "./Consent";
import { youtubeCopy } from "@/components/youtube/copy";
import { connectionsCopy as c } from "./copy";

type Result = Promise<{ error: string } | undefined | void>;
export type HubConnection = {
  id: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  selected: ConnectionEntity[];
  // How many locations/sites/properties the account offers; null (or absent) until the list was loaded.
  entityCount?: number | null;
};
// Clients see the field and when; values stay in the team pane (C-c).
export type HubChange = { id: string; connectionId: string; field: string; at: string };
export type HubActions = {
  revoke: (connectionId: string) => Result;
  notify: (connector: ConnectorKey) => Result;
  entities: (connectionId: string) => Promise<ConnectionEntity[] | { error: string }>;
  pick: (connectionId: string, ids: string[]) => Result;
};
export type HubProps = {
  businessId: string;
  industry: Industry;
  connections: HubConnection[];
  interest: ConnectorKey[];
  changes: HubChange[];
  canConnect: boolean;
  // Where Google's callback sends the user back (safeReturn allows /app, /client and /team).
  returnTo: string;
  // The callback's ?connection=&status=.
  outcome: { connector: string | null; status: string } | null;
  actions: HubActions;
  // G1: the business has no keyword (cuisine null), so no R19–R21 fixes exist; the tile says so.
  youtubeNoKeyword?: boolean;
};

const STATUS_TONE = { connected: "success", needs_reauth: "warn", revoked: "error" } as const;
function Picker({
  connector,
  options,
  selected,
  onSave,
}: {
  connector: GoogleConnector;
  options: ConnectionEntity[];
  selected: ConnectionEntity[];
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState(() => new Set(selected.map((s) => s.id)));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(options.filter((o) => ids.has(o.id)).map((o) => o.id));
      }}
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-caption font-semibold">{c.pick[connector]}</legend>
        {options.map((o) => (
          <label key={o.id} className="flex min-h-11 items-center gap-3 text-ui md:min-h-8">
            <input
              type="checkbox"
              checked={ids.has(o.id)}
              onChange={() =>
                setIds((s) => {
                  const n = new Set(s);
                  if (n.has(o.id)) n.delete(o.id);
                  else n.add(o.id);
                  return n;
                })
              }
              className="size-4 accent-[var(--color-accent)]"
            />
            <span data-computed>{o.name}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit">{c.save}</Button>
      </div>
    </form>
  );
}

// UI.md: one primary per screen (X30). Only the next unconnected Recommended tile's Connect is filled.
function TileCard({
  tile,
  primary,
  props,
  onConsent,
  onRevoke,
  onFailed,
}: {
  tile: Tile;
  primary: boolean;
  props: HubProps;
  onConsent: (k: GoogleConnector) => void;
  onRevoke: (id: string) => void;
  onFailed: () => void;
}) {
  const { connector } = tile;
  const conn = props.connections.find((x) => x.provider === connector);
  const changes = conn ? props.changes.filter((x) => x.connectionId === conn.id) : [];
  const [noted, setNoted] = useState(props.interest.includes(connector));
  const [options, setOptions] = useState<ConnectionEntity[] | null>(null);
  const write = props.canConnect;
  // recommend() marks every tile without a working flow (and the whole later tier) as coming soon.
  const comingSoon = tile.available === "coming_soon";
  const k = connector as GoogleConnector;
  let actions: ReactNode = null;
  if (write && comingSoon)
    actions = noted ? (
      <p role="status" className="text-caption text-text2">
        {c.noted}
      </p>
    ) : (
      <Button
        variant="alt"
        onClick={async () => {
          const r = await props.actions.notify(connector).catch(() => ({ error: "failed" }));
          if (r && "error" in r) return onFailed();
          setNoted(true);
        }}
      >
        {c.notify}
      </Button>
    );
  else if (write && (!conn || conn.status === "revoked"))
    actions = (
      <Button variant={primary ? "primary" : "alt"} onClick={() => onConsent(k)}>
        {c.connect}
      </Button>
    );
  else if (write && conn?.status === "needs_reauth")
    // The banner at the top holds the filled Reconnect (X12/X30); the tile's copy stays secondary.
    actions = (
      <Button variant="alt" onClick={() => onConsent(k)}>
        {c.reconnect}
      </Button>
    );
  else if (write && conn)
    actions = (
      <>
        {/* X30: "Choose …" only when there's a choice. Unknown (null) still offers it: loading the list is
            what records the count (#183). */}
        {(conn.entityCount ?? 2) > 1 && (
          <Button
            variant="alt"
            onClick={async () => {
              const r = await props.actions.entities(conn.id).catch(() => ({ error: "failed" }));
              if ("error" in r) return onFailed();
              setOptions(r);
            }}
          >
            {c.pick[k]}
          </Button>
        )}
        <Button variant="alt" onClick={() => onRevoke(conn.id)}>
          {c.disconnect}
        </Button>
      </>
    );
  if (!write && comingSoon && noted)
    actions = (
      <p role="status" className="text-caption text-text2">
        {c.noted}
      </p>
    );

  return (
    <article
      aria-label={c.names[connector]}
      className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 md:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ui font-semibold">{c.names[connector]}</h3>
        {comingSoon ? (
          <Badge tone="info">{c.comingSoon}</Badge>
        ) : (
          conn && (
            <span data-testid="status">
              <Badge tone={STATUS_TONE[conn.status]}>{c.statuses[conn.status]}</Badge>
            </span>
          )
        )}
      </header>
      <p className="text-caption text-text2">{c.niches[tile.niche]}</p>
      {connector === "youtube" && conn?.status === "connected" && props.youtubeNoKeyword && (
        <p className="text-caption">{youtubeCopy.noKeyword}</p>
      )}
      {conn && conn.status !== "revoked" && conn.selected.length > 0 && (
        <ul className="flex flex-col gap-1 text-caption text-ink">
          {conn.selected.map((s) => (
            <li key={s.id} data-computed>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      {changes.length > 0 && (
        <ul aria-label={c.changes} className="flex flex-col gap-1 border-t border-border pt-2 text-caption text-text2">
          {changes.map((x) => (
            <li key={x.id} className="flex justify-between gap-3">
              <span>{c.fields[x.field as keyof typeof c.fields] ?? x.field}</span>
              <span data-computed className="font-mono tabular-nums">
                {x.at.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {options && conn && (
        <Picker
          connector={k}
          options={options}
          selected={conn.selected}
          onSave={async (ids) => {
            const r = await props.actions.pick(conn.id, ids).catch(() => ({ error: "failed" }));
            if (r && "error" in r) return onFailed();
            setOptions(null);
          }}
        />
      )}
      {actions && <div className="mt-auto flex flex-wrap items-center gap-3">{actions}</div>}
    </article>
  );
}

// X12: the Coming soon connectors as one line of names and one Notify me that registers each one not yet
// noted, then "We'll let you know." Read-only viewers see the names (and the note once everything is noted).
function ComingSoon({
  connectors,
  props,
  onFailed,
}: {
  connectors: ConnectorKey[];
  props: HubProps;
  onFailed: () => void;
}) {
  // The connectors registered so far, the saved interest plus this visit's successes, so a retry after a
  // partial failure sends only what's still missing (#196 review).
  const [done, setDone] = useState<ConnectorKey[]>(props.interest);
  const noted = connectors.every((k) => done.includes(k));
  return (
    <section aria-labelledby="tier-later" className="flex flex-col gap-3">
      <h2 id="tier-later" className="text-ui font-semibold">
        {c.tiers.later}
      </h2>
      <p data-computed className="text-caption text-text2">
        {connectors.map((k) => c.names[k]).join(" · ")}
      </p>
      {noted ? (
        <p role="status" className="text-caption text-text2">
          {c.noted}
        </p>
      ) : (
        props.canConnect && (
          <div>
            <Button
              variant="alt"
              onClick={async () => {
                const rest = connectors.filter((k) => !done.includes(k));
                const r = await Promise.all(
                  rest.map((k) => props.actions.notify(k).catch(() => ({ error: "failed" }))),
                );
                const ok = rest.filter((_, i) => !(r[i] && "error" in r[i]!));
                setDone((d) => [...d, ...ok]);
                if (ok.length < rest.length) onFailed();
              }}
            >
              {c.notify}
            </Button>
          </div>
        )
      )}
    </section>
  );
}

// Settings → Connections (C-a): tiles by industry from recommend(), in Recommended / Optional / Coming
// soon. Only the live Google connectors connect; the rest are Coming soon + Notify me (no fake buttons).
export function ConnectionsHub(props: HubProps) {
  const [consent, setConsent] = useState<GoogleConnector | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const r = recommend(props.industry);
  const o = props.outcome;
  const conn = (k: string) => props.connections.find((x) => x.provider === k);
  // X12: live tiles stay as cards; every Coming soon connector (any tier) folds into the one line below.
  const live = {
    recommended: r.recommended.filter((t) => t.available === "live"),
    optional: r.optional.filter((t) => t.available === "live"),
  };
  const soon = [...r.recommended, ...r.optional, ...r.later]
    .filter((t) => t.available === "coming_soon")
    .map((t) => t.connector);
  const attention = props.connections.filter((x) => x.status === "needs_reauth");
  // X30: the next unconnected Recommended tile, unless a reconnect banner already holds the primary.
  const next = attention.length
    ? null
    : (live.recommended.find((t) => !conn(t.connector) || conn(t.connector)!.status === "revoked")?.connector ?? null);

  return (
    <div className="flex flex-col gap-8">
      {o &&
        (o.status === "connected" ? (
          <Banner tone="info">
            {c.outcomes.connected(c.names[(o.connector ?? "gbp") as GoogleConnector] ?? c.names.gbp)}
          </Banner>
        ) : o.status === "denied" ? (
          <Banner tone="info">{c.outcomes.denied}</Banner>
        ) : (
          <Banner tone="error">{c.outcomes.error}</Banner>
        ))}
      {failed && <Banner tone="error">{c.failed}</Banner>}
      {/* X12: what needs attention comes first, as a warn banner; its Reconnect is the one primary. */}
      {attention.map((conn) => (
        <Banner
          key={conn.id}
          tone="warn"
          primary
          action={
            props.canConnect
              ? { label: c.reconnect, onClick: () => setConsent(conn.provider as GoogleConnector) }
              : undefined
          }
        >
          {`${c.names[conn.provider as GoogleConnector]}: ${c.statuses.needs_reauth}`}
        </Banner>
      ))}
      {(["recommended", "optional"] as const).map(
        (tier) =>
          live[tier].length > 0 && (
            <section key={tier} aria-labelledby={`tier-${tier}`} className="flex flex-col gap-3">
              <h2 id={`tier-${tier}`} className="text-ui font-semibold">
                {c.tiers[tier]}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {live[tier].map((t) => (
                  <TileCard
                    key={t.connector}
                    tile={t}
                    primary={t.connector === next}
                    props={props}
                    onConsent={setConsent}
                    onRevoke={setRevoke}
                    onFailed={() => setFailed(true)}
                  />
                ))}
              </div>
            </section>
          ),
      )}
      {soon.length > 0 && <ComingSoon connectors={soon} props={props} onFailed={() => setFailed(true)} />}
      {consent && (
        <Consent
          connector={consent}
          href={startUrl(props.businessId, consent, props.returnTo)}
          onClose={() => setConsent(null)}
        />
      )}
      {revoke && (
        <Dialog
          message={c.revokeConfirm}
          confirm={c.disconnect}
          onClose={() => setRevoke(null)}
          onConfirm={async () => {
            const id = revoke;
            setRevoke(null);
            const res = await props.actions.revoke(id).catch(() => ({ error: "failed" }));
            if (res && "error" in res) setFailed(true);
          }}
        />
      )}
    </div>
  );
}
