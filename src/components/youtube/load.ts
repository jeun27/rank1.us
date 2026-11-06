import "server-only";
import { loadYoutubeChecklist, type YoutubeChecklist } from "@/lib/connections/service";
import type { DbClient } from "@/lib/queries/client";
import { listConnections } from "@/lib/queries/connections";
import { createServiceClient } from "@/lib/supabase/service";

export const YOUTUBE_RULES = new Set(["R19", "R20", "R21"]);

// G1: /app/fixes reads the checklist (a live YouTube read) only with ENABLE_CONNECTIONS on, an open P4 fix
// (R19–R21) to attach it to, and a non-revoked YouTube connection. The result or its failure code.
export async function loadYoutubeEvidence(
  db: DbClient,
  businessId: string,
  openRules: string[],
  env: Record<string, string | undefined> = process.env,
): Promise<YoutubeChecklist | string | null> {
  if (env.ENABLE_CONNECTIONS !== "true" || !openRules.some((r) => YOUTUBE_RULES.has(r))) return null;
  const yt = (await listConnections(db, businessId)).find((c) => c.provider === "youtube" && c.status !== "revoked");
  if (!yt) return null;
  return loadYoutubeChecklist({ userDb: db, serviceDb: createServiceClient(), env }, yt.id);
}
