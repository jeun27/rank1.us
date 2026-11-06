import { describe, expect, it } from "vitest";
import { listConnections, saveConnection, setConnectionEntityCount } from "@/lib/queries/connections";
import { makeWorkspace, newUser, serviceClient } from "./helpers";

// 0040: connections.entity_count, how many locations/sites/properties the account offers, stored when
// the picker list is loaded, so the hub shows "Choose …" only when there is more than one.
const s = () => serviceClient();

async function connected(tag: string) {
  const owner = await newUser(tag);
  const { businessId } = await makeWorkspace(owner);
  const id = await saveConnection(s(), {
    businessId,
    provider: "gbp",
    externalAccountId: `google-sub-${tag}`,
    scopes: [],
    connectedBy: owner.id,
    encAccess: "enc:v1:a",
    encRefresh: "enc:v1:r",
    expiresAt: null,
  });
  return { owner, businessId, id };
}

describe("connection entity count", () => {
  it("is null until set, then readable by members through listConnections", async () => {
    const { owner, businessId, id } = await connected("ec-a");
    expect((await listConnections(owner.db, businessId))[0].entity_count).toBeNull();
    await setConnectionEntityCount(s(), id, 3);
    expect((await listConnections(owner.db, businessId))[0].entity_count).toBe(3);
    await setConnectionEntityCount(s(), id, 1);
    expect((await listConnections(owner.db, businessId))[0].entity_count).toBe(1);
  });

  it("is per connection, not grant-wide", async () => {
    const { owner, businessId, id } = await connected("ec-b");
    const sc = await saveConnection(s(), {
      businessId,
      provider: "search_console",
      externalAccountId: "google-sub-ec-b",
      scopes: [],
      connectedBy: owner.id,
      encAccess: "enc:v1:a",
      encRefresh: "enc:v1:r",
      expiresAt: null,
    });
    await setConnectionEntityCount(s(), id, 4);
    const rows = await listConnections(owner.db, businessId);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.entity_count]))).toEqual({ [id]: 4, [sc]: null });
  });

  it("refuses a negative or huge count (22023), an unknown connection (22023), and users (42501)", async () => {
    const { owner, id } = await connected("ec-c");
    for (const n of [-1, 100_001]) {
      await expect(setConnectionEntityCount(s(), id, n)).rejects.toMatchObject({ code: "22023" });
    }
    await expect(setConnectionEntityCount(s(), crypto.randomUUID(), 2)).rejects.toMatchObject({ code: "22023" });
    await expect(setConnectionEntityCount(owner.db, id, 2)).rejects.toMatchObject({ code: "42501" });
    const direct = await owner.db.from("connections").update({ entity_count: 9 }).eq("id", id);
    expect(direct.error?.code).toBe("42501");
  });
});
