"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog } from "@/components/billing/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import type { GoogleConnector } from "@/lib/connections/oauth";
import { recommend, type Industry, type Tile } from "@/lib/connections/recommend";
import type { ConnectionEntity, ConnectionProvider, ConnectionStatus, ConnectorKey } from "@/lib/queries/connections";
import { connectionsCopy as c } from "./copy";

type Result = Promise<{ error: string } | undefined | void>;
export type HubConnection = {
  id: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  selected: ConnectionEntity[];
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
};

const STATUS_TONE = { connected: "success", needs_reauth: "warn", revoked: "error" } as const;
const startUrl = (businessId: string, connector: string, returnTo: string) =>
  `/api/connections/google/start?business=${encodeURIComponent(businessId)}&connector=${connector}&return=${encodeURIComponent(returnTo)}`;

// The consent sheet: a modal with the exact scope text, then Continue to Google. Esc closes; focus stays
// inside and returns to the opener.
function Consent({ connector, href, onClose }: { connector: GoogleConnector; href: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const title = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => opener?.focus();
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      return onClose();
    }
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("a, button")];
    const [first, last] = [f[0], f[f.length - 1]];
    const to = e.shiftKey
      ? document.activeElement === first
        ? last
        : null
      : document.activeElement === last
        ? first
        : null;
    if (to) {
      e.preventDefault();
      to.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgb(0_0_0/0.6)] p-4" onKeyDown={onKey}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        className="flex w-full max-w-lg flex-col gap-4 rounded-card border border-border bg-overlay p-5 shadow-overlay"
      >
        <h2 id={title} className="text-ui font-semibold">
          {c.names[connector]}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ui text-text2">
          {c.consent[connector].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button href={href}>{c.continue}</Button>
          <Button variant="alt" onClick={onClose}>
            {c.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}

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

function TileCard({
  tile,
  props,
  onConsent,
  onRevoke,
  onFailed,
}: {
  tile: Tile;
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
    actions = <Button onClick={() => onConsent(k)}>{c.connect}</Button>;
  else if (write && conn?.status === "needs_reauth")
    actions = <Button onClick={() => onConsent(k)}>{c.reconnect}</Button>;
  else if (write && conn)
    actions = (
      <>
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
    <article aria-label={c.names[connector]} className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 md:p-5">
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

// Settings → Connections (C-a): tiles by industry from recommend(), in Recommended / Optional / Coming
// soon. Only the live Google connectors connect; the rest are Coming soon + Notify me (no fake buttons).
export function ConnectionsHub(props: HubProps) {
  const [consent, setConsent] = useState<GoogleConnector | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const r = recommend(props.industry);
  const o = props.outcome;

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
      {(["recommended", "optional", "later"] as const).map(
        (tier) =>
          r[tier].length > 0 && (
            <section key={tier} aria-labelledby={`tier-${tier}`} className="flex flex-col gap-3">
              <h2 id={`tier-${tier}`} className="text-ui font-semibold">
                {c.tiers[tier]}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {r[tier].map((t) => (
                  <TileCard
                    key={t.connector}
                    tile={t}
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
