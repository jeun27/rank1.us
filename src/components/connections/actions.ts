"use server";
import { revalidatePath } from "next/cache";
import {
  connectionsEnabled,
  listConnectionEntities,
  pickConnectionEntities,
  revokeGoogleConnection,
  type Ctx,
} from "@/lib/connections/service";
import { noteConnectorInterest, type ConnectorKey } from "@/lib/queries/connections";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// The hub's writes. Each service call checks the flag and the caller's own access (can_connect_business)
// before it touches the service client; the browser only names the connection. Errors carry a reason only.
const ctx = async (): Promise<Ctx> => ({ userDb: await createClient(), serviceDb: createServiceClient() });
const done = () => {
  revalidatePath("/app/settings/connections");
  revalidatePath("/client/settings/connections");
};

export async function revokeConnectionAction(connectionId: string) {
  const r = await revokeGoogleConnection(await ctx(), connectionId);
  if (r !== "revoked") return { error: r };
  done();
}

export async function listEntitiesAction(connectionId: string) {
  const r = await listConnectionEntities(await ctx(), connectionId);
  return typeof r === "string" ? { error: r } : r;
}

export async function pickEntitiesAction(connectionId: string, ids: string[]) {
  const r = await pickConnectionEntities(await ctx(), connectionId, ids);
  if (typeof r === "string") return { error: r };
  done();
}

// note_connector_interest checks the caller may act for this business (42501 otherwise).
export async function notifyAction(businessId: string, connector: ConnectorKey) {
  if (!connectionsEnabled()) return { error: "disabled" };
  try {
    await noteConnectorInterest(await createClient(), businessId, connector);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
}
