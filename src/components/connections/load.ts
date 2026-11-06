import "server-only";
import { loadYoutubeChecklist } from "@/lib/connections/service";
import { createServiceClient } from "@/lib/supabase/service";
import { connectCardState, type CardState } from "@/lib/connections/connect-card";
import { INDUSTRIES, type Industry } from "@/lib/connections/recommend";
import {
  canConnectBusiness,
  getBusinessVertical,
  listConnectionChanges,
  listConnections,
  listConnectorInterest,
} from "@/lib/queries/connections";
import type { DbClient } from "@/lib/queries/client";
import { getGasReady } from "@/lib/queries/gas-ready";
import type { HubProps } from "./ConnectionsHub";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
const industryOf = (vertical: string | null): Industry =>
  (INDUSTRIES as readonly string[]).includes(vertical ?? "") ? (vertical as Industry) : "other";

// Everything the hub shows for one business, read with the caller's client (RLS). Actions are added by the page.
export async function loadHub(
  db: DbClient,
  businessId: string,
  returnTo: string,
  params: Record<string, string | string[] | undefined>,
): Promise<Omit<HubProps, "actions">> {
  const [vertical, connections, interest, changes, canConnect] = await Promise.all([
    getBusinessVertical(db, businessId),
    listConnections(db, businessId),
    listConnectorInterest(db, businessId),
    listConnectionChanges(db, businessId, 20),
    canConnectBusiness(db, businessId),
  ]);
  const status = one(params.status);
  // G1: the YouTube tile's "Connected · {n} videos checked" (a live read; nothing on a failure).
  const yt = connections.find((c) => c.provider === "youtube" && c.status === "connected");
  const checklist = yt ? await loadYoutubeChecklist({ userDb: db, serviceDb: createServiceClient() }, yt.id) : null;
  return {
    businessId,
    industry: industryOf(vertical),
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      selected: c.selected_entities,
    })),
    interest: [...new Set(interest.map((i) => i.provider))],
    changes: changes.map((x) => ({ id: x.id, connectionId: x.connection_id, field: x.field, at: x.created_at })),
    canConnect,
    returnTo,
    outcome: status ? { connector: one(params.connection), status } : null,
    ...(checklist &&
      typeof checklist === "object" && {
        youtubeVideos: checklist.videos.length,
        youtubeNoKeyword: !checklist.keyword,
      }),
  };
}

// C-b: the connect card for one business, or null (flag off, nothing Recommended, or all set > 7 days).
// readyNow (the onboarding step): all connected counts as all set, before gas_ready_at catches up.
export async function loadConnectCard(
  db: DbClient,
  businessId: string,
  now: Date,
  readyNow = false,
): Promise<{ state: NonNullable<CardState>; canConnect: boolean } | null> {
  if (process.env.ENABLE_CONNECTIONS !== "true") return null;
  const [vertical, connections, ready, canConnect] = await Promise.all([
    getBusinessVertical(db, businessId),
    listConnections(db, businessId),
    getGasReady(db, businessId),
    canConnectBusiness(db, businessId),
  ]);
  const readyAt = ready?.readyAt ?? (readyNow ? now.toISOString() : null);
  const state = connectCardState({ industry: industryOf(vertical), connections, readyAt, now });
  return state && { state, canConnect };
}
