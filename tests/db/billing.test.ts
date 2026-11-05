import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import {
  applyStripeSubscription,
  archiveScheduledBusinesses,
  cancelBusinessRemoval,
  getBillingState,
  listMyBusinesses,
  recordStripeEvent,
  scheduleBusinessRemoval,
  type StripeSubscriptionEvent,
} from "@/lib/queries/billing";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { anonClient, must, newUser, serviceClient } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

// A self-serve workspace with `count` active businesses (seats raised by the service role first).
async function workspace(tag: string, count = 1) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  const first = await createBusinessOnboarding(user.db, {
    business: {
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
  const s = serviceClient();
  must(
    await s
      .from("workspaces")
      .update({ seats_quantity: Math.max(count, 1) })
      .eq("id", workspaceId),
  );
  const ids = [first];
  for (let i = 1; i < count; i++) {
    const later = new Date(Date.now() + i * 1000).toISOString();
    ids.push(
      must(
        await s
          .from("businesses")
          .insert({ workspace_id: workspaceId, name: `Example Business ${i}`, created_at: later })
          .select("id")
          .single(),
      ).id,
    );
  }
  return { user, workspaceId, businessIds: ids };
}

let clock = Date.now() - 3600 * 1000;
const event = (extra: Partial<StripeSubscriptionEvent>): StripeSubscriptionEvent => ({
  event_id: `evt_${randomUUID()}`,
  event_type: "customer.subscription.updated",
  event_created: new Date((clock += 1000)).toISOString(),
  customer_id: `cus_${randomUUID()}`,
  subscription_id: `sub_${randomUUID()}`,
  status: "active",
  quantity: 1,
  current_period_end: iso(30 * 86400 * 1000),
  ...extra,
});
const ws = async (id: string) => must(await serviceClient().from("workspaces").select("*").eq("id", id).single());
const biz = async (id: string) =>
  must(await serviceClient().from("businesses").select("archived_at, archive_at").eq("id", id).single());

describe("apply_stripe_subscription", () => {
  it("finds the workspace by client_reference_id, then by customer id, and stores ids, status, seats and period end", async () => {
    const { workspaceId } = await workspace("stripe-apply");
    const customer = `cus_${randomUUID()}`;
    const first = event({
      event_type: "checkout.session.completed",
      customer_id: customer,
      client_reference_id: workspaceId,
      quantity: 2,
    });
    expect(await applyStripeSubscription(serviceClient(), first)).toBe("applied");
    expect(await ws(workspaceId)).toMatchObject({
      stripe_customer_id: customer,
      stripe_subscription_id: first.subscription_id,
      subscription_status: "active",
      seats_quantity: 2,
      stripe_current_period_end: expect.any(String),
    });

    const second = event({
      customer_id: customer,
      subscription_id: first.subscription_id,
      status: "past_due",
      quantity: 2,
    });
    expect(await applyStripeSubscription(serviceClient(), second)).toBe("applied");
    expect((await ws(workspaceId)).subscription_status).toBe("past_due");
  });

  it("a duplicate event id is a no-op, even with a different payload", async () => {
    const { workspaceId } = await workspace("stripe-dup");
    const first = event({ client_reference_id: workspaceId, status: "active" });
    await applyStripeSubscription(serviceClient(), first);
    expect(await applyStripeSubscription(serviceClient(), { ...first, status: "canceled", quantity: 9 })).toBe(
      "duplicate",
    );
    expect(await ws(workspaceId)).toMatchObject({ subscription_status: "active", seats_quantity: 1 });
  });

  it("ignores an event older than the last applied one", async () => {
    const { workspaceId } = await workspace("stripe-stale");
    const newer = event({ client_reference_id: workspaceId, status: "past_due" });
    const older = {
      ...event({ customer_id: newer.customer_id, status: "active" }),
      event_created: new Date(Date.parse(newer.event_created) - 60_000).toISOString(),
    };
    await applyStripeSubscription(serviceClient(), newer);
    expect(await applyStripeSubscription(serviceClient(), older)).toBe("stale");
    expect((await ws(workspaceId)).subscription_status).toBe("past_due");
  });

  it("returns not_found for an unknown customer, or a reference to a workspace with another customer", async () => {
    expect(await applyStripeSubscription(serviceClient(), event({}))).toBe("not_found");
    const { workspaceId } = await workspace("stripe-other");
    await applyStripeSubscription(serviceClient(), event({ client_reference_id: workspaceId }));
    expect(await applyStripeSubscription(serviceClient(), event({ client_reference_id: workspaceId }))).toBe(
      "not_found",
    );
  });

  it("rejects a bad status or missing ids (22023) without recording the event, so a retry works", async () => {
    const { workspaceId } = await workspace("stripe-bad");
    const bad = event({ client_reference_id: workspaceId, status: "paused" as never });
    await expect(applyStripeSubscription(serviceClient(), bad)).rejects.toMatchObject({ code: "22023" });
    await expect(
      applyStripeSubscription(serviceClient(), { ...bad, status: "active", event_id: "" }),
    ).rejects.toMatchObject({ code: "22023" });
    expect(await applyStripeSubscription(serviceClient(), { ...bad, status: "active" })).toBe("applied");
  });
});

describe("record_stripe_event", () => {
  it("is true once, then false", async () => {
    const id = `evt_${randomUUID()}`;
    expect(await recordStripeEvent(serviceClient(), id, "invoice.paid")).toBe(true);
    expect(await recordStripeEvent(serviceClient(), id, "invoice.paid")).toBe(false);
  });
});

describe("scheduled removal → archive", () => {
  it("archives at the period end, before lowering seats, and never earlier", async () => {
    const { user, workspaceId, businessIds } = await workspace("stripe-remove", 2);
    const [keep, drop] = businessIds;
    const sub = event({ client_reference_id: workspaceId, quantity: 2 });
    await applyStripeSubscription(serviceClient(), sub);
    await scheduleBusinessRemoval(serviceClient(), drop, iso(3600 * 1000));

    await applyStripeSubscription(serviceClient(), event({ customer_id: sub.customer_id, quantity: 2 }));
    expect(await biz(drop)).toMatchObject({ archived_at: null, archive_at: expect.any(String) });
    expect((await getBillingState(user.db))?.scheduledRemovals.map((r) => r.businessId)).toEqual([drop]);

    // The period ends: the renewal event brings quantity 1 while 2 businesses are still active.
    must(
      await serviceClient()
        .from("businesses")
        .update({ archive_at: iso(-1000) })
        .eq("id", drop),
    );
    expect(await applyStripeSubscription(serviceClient(), event({ customer_id: sub.customer_id, quantity: 1 }))).toBe(
      "applied",
    );
    expect((await biz(drop)).archived_at).not.toBeNull();
    expect((await biz(drop)).archive_at).toBeNull();
    expect((await biz(keep)).archived_at).toBeNull();
    expect((await ws(workspaceId)).seats_quantity).toBe(1);
    expect((await listMyBusinesses(user.db)).map((b) => b.id)).toEqual([keep]);
  });

  it("archive_scheduled_businesses is a safety net for due removals", async () => {
    const { businessIds } = await workspace("stripe-net", 2);
    await scheduleBusinessRemoval(serviceClient(), businessIds[1], iso(3600 * 1000));
    must(
      await serviceClient()
        .from("businesses")
        .update({ archive_at: iso(-1000) })
        .eq("id", businessIds[1]),
    );
    expect(await archiveScheduledBusinesses(serviceClient())).toBeGreaterThanOrEqual(1);
    expect((await biz(businessIds[1])).archived_at).not.toBeNull();
  });

  it("cancel undoes a scheduled removal; bad schedules are rejected (22023)", async () => {
    const { businessIds } = await workspace("stripe-cancel", 2);
    await scheduleBusinessRemoval(serviceClient(), businessIds[1], iso(3600 * 1000));
    await cancelBusinessRemoval(serviceClient(), businessIds[1]);
    expect((await biz(businessIds[1])).archive_at).toBeNull();

    await expect(scheduleBusinessRemoval(serviceClient(), businessIds[1], iso(-1000))).rejects.toMatchObject({
      code: "22023",
    });
    must(
      await serviceClient()
        .from("businesses")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", businessIds[1]),
    );
    await expect(scheduleBusinessRemoval(serviceClient(), businessIds[1], iso(3600 * 1000))).rejects.toMatchObject({
      code: "22023",
    });
    await expect(cancelBusinessRemoval(serviceClient(), businessIds[1])).rejects.toMatchObject({ code: "22023" });
  });

  it("DFY businesses are never scheduled or archived by Stripe events", async () => {
    const team = await newUser("stripe-team");
    must(await serviceClient().from("user_roles").insert({ user_id: team.id, role: "team" }));
    const dfy = await createDfyClient(team.db, {
      workspace_name: "Example DFY",
      business: {
        name: "Example Pho Spot",
        domain: "example-pho.test",
        cuisine: "pho",
        city: "Irvine",
        state: "CA",
        country: "US",
        aliases: [],
      },
    });
    await expect(scheduleBusinessRemoval(serviceClient(), dfy.businessId, iso(3600 * 1000))).rejects.toMatchObject({
      code: "22023",
    });

    const { workspaceId } = await workspace("stripe-mixed");
    const inside = must(
      await serviceClient()
        .from("businesses")
        .insert({ workspace_id: workspaceId, name: "Example DFY Inside", service: "dfy", archive_at: iso(-1000) })
        .select("id")
        .single(),
    );
    await applyStripeSubscription(serviceClient(), event({ client_reference_id: workspaceId }));
    expect((await biz(inside.id)).archived_at).toBeNull();
    expect(await getBillingState(team.db)).toMatchObject({ activeCount: 0 });
  });
});

describe("members never write billing fields", () => {
  it("refuses member updates of every billing and removal column (42501)", async () => {
    const { user, workspaceId, businessIds } = await workspace("stripe-member");
    for (const field of [
      "seats_quantity",
      "subscription_status",
      "stripe_customer_id",
      "stripe_subscription_id",
      "stripe_current_period_end",
      "stripe_event_at",
    ]) {
      const value =
        field === "seats_quantity" ? 9 : field.endsWith("_at") || field.endsWith("_end") ? iso(0) : "hacked";
      const { error } = await loose(user.db)
        .from("workspaces")
        .update({ [field]: value })
        .eq("id", workspaceId);
      expect(error?.code, field).toBe("42501");
    }
    const { error } = await loose(user.db)
      .from("businesses")
      .update({ archive_at: iso(3600 * 1000) })
      .eq("id", businessIds[0]);
    expect(error?.code).toBe("42501");
  });

  it("every Stripe function is service role only (42501)", async () => {
    const { user, businessIds } = await workspace("stripe-caller");
    for (const db of [user.db, anonClient()]) {
      for (const [fn, args] of [
        ["apply_stripe_subscription", { p: event({}) }],
        ["record_stripe_event", { p_event_id: "evt_x", p_type: "x" }],
        ["schedule_business_removal", { p_business_id: businessIds[0], p_at: iso(3600 * 1000) }],
        ["cancel_business_removal", { p_business_id: businessIds[0] }],
        ["archive_scheduled_businesses", {}],
      ] as const) {
        expect((await loose(db).rpc(fn, args)).error?.code, fn).toBe("42501");
      }
    }
  });
});

describe("billing state and the current business", () => {
  it("getBillingState returns the caller's workspace state without Stripe ids", async () => {
    const { user, workspaceId } = await workspace("stripe-state", 2);
    expect(await getBillingState(user.db)).toEqual({
      workspaceId,
      status: null,
      seats: 2,
      activeCount: 2,
      hasCustomer: false,
      nextInvoiceAt: null,
      scheduledRemovals: [],
    });
    const sub = event({ client_reference_id: workspaceId, quantity: 2, status: "trialing" });
    await applyStripeSubscription(serviceClient(), sub);
    const state = (await getBillingState(user.db))!;
    expect(state).toMatchObject({ status: "trialing", hasCustomer: true, nextInvoiceAt: expect.any(String) });
    expect(JSON.stringify(state)).not.toContain(sub.customer_id);
    const stranger = await newUser("stripe-stranger");
    expect(await getBillingState(stranger.db)).toBeNull();
  });

  it("getCurrentBusiness honors the caller's own selection, else the oldest", async () => {
    const { user, businessIds } = await workspace("stripe-switch", 2);
    const other = await workspace("stripe-switch-other");
    expect((await getCurrentBusiness(user.db))?.id).toBe(businessIds[0]);
    expect((await getCurrentBusiness(user.db, businessIds[1]))?.id).toBe(businessIds[1]);
    expect((await getCurrentBusiness(user.db, other.businessIds[0]))?.id).toBe(businessIds[0]);
    expect((await getCurrentBusiness(user.db, "not-a-uuid"))?.id).toBe(businessIds[0]);
    must(
      await serviceClient()
        .from("businesses")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", businessIds[1]),
    );
    expect((await getCurrentBusiness(user.db, businessIds[1]))?.id).toBe(businessIds[0]);
    expect((await listMyBusinesses(user.db)).map((b) => b.id)).toEqual([businessIds[0]]);
  });
});
