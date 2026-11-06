"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { appCopy } from "@/components/app/copy";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CardState } from "@/lib/connections/connect-card";
import type { GoogleConnector } from "@/lib/connections/oauth";
import { Consent, startUrl } from "./Consent";
import { connectionsCopy as c } from "./copy";

export type ConnectCardProps = {
  state: NonNullable<CardState>;
  businessId: string;
  // Where Google's callback sends the user back.
  returnTo: string;
  canConnect: boolean;
  // The all-set copy: self-serve or the DFY client (lead Q1).
  audience: "self" | "dfy";
  // The all-set link to the fix list, where there is a page for it.
  fixesHref?: string | null;
  // On the onboarding step: "Skip for now" while connecting, "Go to your dashboard" once all set.
  skipHref?: string;
};

const link = "text-ui text-link underline underline-offset-4";

// C-b: "Connect your accounts" until every Recommended connection is connected (connectCardState), then
// "You're all set" (G3). Not dismissible (the brief's "persistent" card). Connect opens the hub's consent sheet.
export function ConnectCard(p: ConnectCardProps) {
  const heading = useId();
  const [consent, setConsent] = useState<GoogleConnector | null>(null);
  const box = "flex flex-col gap-4 rounded-card border border-border bg-white p-4 md:p-5";

  if (p.state.kind === "ready") {
    const names = p.state.connectors.map((k) => c.names[k]);
    return (
      <section aria-labelledby={heading} className={box}>
        <h2 id={heading} className="text-ui font-semibold">
          {c.card.readyTitle}
        </h2>
        <p className="text-ui text-text2">{c.card.readyBody(p.audience, names)}</p>
        {p.skipHref ? (
          <div>
            <Button href={p.skipHref}>{c.card.toDashboard}</Button>
          </div>
        ) : (
          p.fixesHref && (
            <Link href={p.fixesHref} className={`self-start ${link}`}>
              {appCopy.fixNext}
            </Link>
          )
        )}
      </section>
    );
  }

  const { rows } = p.state;
  const n = rows.filter((r) => r.status === "connected").length;
  const count = c.card.count(n, rows.length);
  return (
    <section aria-labelledby={heading} className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={heading} className="text-ui font-semibold">
          {c.card.title}
        </h2>
        <span data-computed className="font-mono text-caption text-inkMuted tabular-nums">
          {count}
        </span>
      </div>
      <p className="text-ui text-text2">{c.card.intro}</p>
      <div
        role="progressbar"
        aria-label={count}
        aria-valuemin={0}
        aria-valuemax={rows.length}
        aria-valuenow={n}
        data-computed
        className="h-1.5 overflow-hidden rounded-full bg-overlay"
      >
        <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${n / rows.length})` }} />
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
        {rows.map((r) => {
          const name = c.names[r.connector];
          const k = r.connector as GoogleConnector;
          const verb = r.status === "needs_reauth" ? c.reconnect : c.connect;
          return (
            <li
              key={r.connector}
              aria-label={name}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 md:px-4"
            >
              <span className="text-ui font-medium">{name}</span>
              {r.status === "connected" ? (
                <Badge tone="success">{c.statuses.connected}</Badge>
              ) : p.canConnect ? (
                <Button
                  variant={p.skipHref ? "primary" : "alt"}
                  aria-label={`${verb} ${name}`}
                  onClick={() => setConsent(k)}
                >
                  {verb}
                </Button>
              ) : (
                r.status === "needs_reauth" && <Badge tone="warn">{c.statuses.needs_reauth}</Badge>
              )}
            </li>
          );
        })}
      </ul>
      {p.skipHref && (
        <Link href={p.skipHref} className={`self-start ${link}`}>
          {c.card.skip}
        </Link>
      )}
      {consent && (
        <Consent
          connector={consent}
          href={startUrl(p.businessId, consent, p.returnTo)}
          onClose={() => setConsent(null)}
        />
      )}
    </section>
  );
}
