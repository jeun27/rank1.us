import type { ConnectionStatus } from "@/lib/queries/connections";
import { readinessSet, type Connector, type Industry } from "./recommend";

// C-b: the dashboard card and the onboarding connect step. Recommended = readinessSet (the same set
// refresh_gas_ready uses), so the card and gas_ready_at agree. "You're all set" shows for READY_DAYS
// after gas_ready_at (lead Q2), then the card hides.
export const READY_DAYS = 7;

export type CardRow = { connector: Connector; status: "connected" | "needs_reauth" | "missing" };
export type CardState = { kind: "connect"; rows: CardRow[] } | { kind: "ready"; connectors: Connector[] } | null;

export function connectCardState({
  industry,
  connections,
  readyAt,
  now,
}: {
  industry: Industry;
  connections: { provider: string; status: ConnectionStatus }[];
  readyAt: string | null;
  now: Date;
}): CardState {
  const set = readinessSet(industry);
  if (!set.length) return null;
  const rows: CardRow[] = set.map((connector) => {
    const status = connections.find((x) => x.provider === connector)?.status;
    return { connector, status: status === "connected" || status === "needs_reauth" ? status : "missing" };
  });
  if (rows.some((r) => r.status !== "connected")) return { kind: "connect", rows };
  if (readyAt && now.getTime() - new Date(readyAt).getTime() < READY_DAYS * 86_400_000)
    return { kind: "ready", connectors: set };
  return null;
}
