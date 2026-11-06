import { describe, expect, it } from "vitest";
import {
  getConnectionTokens,
  noteConnectorInterest,
  revokeConnection,
  saveConnection,
  setConnectionStatus,
} from "@/lib/queries/connections";
import { refreshGasReady } from "@/lib/queries/gas-ready";
import { makeWorkspace, must, newUser, serviceClient } from "./helpers";

// 0036: youtube is a connector that shares the Google grant (same business + Google sub) with
// gbp/search_console/ga4, and a known key for interest and readiness.
const s = () => serviceClient();
const google = (businessId: string, provider: "gbp" | "youtube", sub = "google-sub-yt", tag = provider) =>
  saveConnection(s(), {
    businessId,
    provider,
    externalAccountId: sub,
    scopes: [],
    connectedBy: null as unknown as string,
    encAccess: `enc:v1:access-${tag}`,
    encRefresh: `enc:v1:refresh-${tag}`,
    expiresAt: null,
  });

describe("youtube connector", () => {
  it("connects, and shares tokens, reauth and revoke with the business's Google grant", async () => {
    const owner = await newUser("yt-owner");
    const { businessId } = await makeWorkspace(owner);
    const gbp = await google(businessId, "gbp");
    const yt = await google(businessId, "youtube");
    expect((await getConnectionTokens(s(), gbp))?.enc_refresh).toBe("enc:v1:refresh-youtube");
    await setConnectionStatus(s(), yt, "needs_reauth");
    expect((await getConnectionTokens(s(), gbp))?.status).toBe("needs_reauth");
    expect((await revokeConnection(s(), gbp)).sort()).toEqual([gbp, yt].sort());
    expect(await getConnectionTokens(s(), yt)).toBeNull();
  });

  it("a different Google account's youtube is its own grant", async () => {
    const owner = await newUser("yt-owner2");
    const { businessId } = await makeWorkspace(owner);
    const gbp = await google(businessId, "gbp", "google-sub-a");
    const yt = await google(businessId, "youtube", "google-sub-b");
    expect(await revokeConnection(s(), yt)).toEqual([yt]);
    expect((await getConnectionTokens(s(), gbp))?.status).toBe("connected");
  });

  it("is a known key for interest and readiness", async () => {
    const owner = await newUser("yt-owner3");
    const { businessId } = await makeWorkspace(owner);
    await noteConnectorInterest(owner.db, businessId, "youtube");
    expect(must(await s().from("connector_interest").select("provider").eq("business_id", businessId))).toEqual([
      { provider: "youtube" },
    ]);
    expect(await refreshGasReady(s(), businessId, ["youtube"])).toEqual({ ready: false, newlyReady: false });
    await google(businessId, "youtube");
    expect(await refreshGasReady(s(), businessId, ["youtube"])).toEqual({ ready: true, newlyReady: true });
  });
});
