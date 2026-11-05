import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { STRIPE_API_VERSION, StripeConfigError, assertTestMode, stripeClient } from "@/lib/stripe/client";
import {
  createCheckoutSession,
  createPortalSession,
  scheduleRemoval,
  updateQuantity,
  BillingError,
} from "@/lib/stripe/billing";
import { sub } from "./fixtures";

afterEach(() => vi.unstubAllEnvs());

describe("assertTestMode", () => {
  it.each(["sk_live_abc", "rk_live_abc", " sk_live_abc "])("refuses the live key %j", (key) => {
    expect(() => assertTestMode(key)).toThrow(StripeConfigError);
    expect(() => stripeClient({ key })).toThrow(/live keys are refused/);
  });

  it("refuses a missing key and accepts a test key", () => {
    expect(() => assertTestMode(undefined)).toThrow(/not set/);
    expect(() => assertTestMode("  ")).toThrow(/not set/);
    expect(assertTestMode("sk_test_example")).toBe("sk_test_example");
  });

  it("pins the API version to the installed SDK's", () => {
    expect(STRIPE_API_VERSION).toBe(Stripe.API_VERSION);
  });
});

// A Stripe client whose HTTP goes to a fake fetch: records each request (method, path, form params).
function fakeStripe(routes: Record<string, unknown>) {
  const calls: { method: string; path: string; params: URLSearchParams }[] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const key = `${init?.method ?? "GET"} ${u.pathname}`;
    calls.push({
      method: init?.method ?? "GET",
      path: u.pathname,
      params: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    const body = routes[key];
    if (body === undefined)
      return new Response(JSON.stringify({ error: { message: `no route ${key}` } }), { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json", "request-id": "req_example" },
    });
  });
  const stripe = stripeClient({
    key: "sk_test_example",
    httpClient: Stripe.createFetchHttpClient(fetchFn as unknown as typeof fetch),
  });
  return { stripe, calls };
}

describe("billing calls (mocked fetch, no network, no real key)", () => {
  it("createCheckoutSession: subscription mode, the $99 price × quantity (min 1), workspace as client_reference_id, stored customer reused", async () => {
    vi.stubEnv("STRIPE_PRICE_ID_BUSINESS", "price_example_99");
    const { stripe, calls } = fakeStripe({
      "POST /v1/checkout/sessions": {
        id: "cs_example",
        object: "checkout.session",
        url: "https://checkout.stripe.com/c/pay/cs_example",
      },
    });
    const url = await createCheckoutSession(stripe, {
      workspaceId: "ws-example-1",
      customerId: "cus_example_1",
      quantity: 0,
      successUrl: "https://rank1.us/app/billing?ok=1",
      cancelUrl: "https://rank1.us/app/billing",
    });
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_example");
    const p = calls[0].params;
    expect(Object.fromEntries(p)).toMatchObject({
      mode: "subscription",
      "line_items[0][price]": "price_example_99",
      "line_items[0][quantity]": "1",
      client_reference_id: "ws-example-1",
      customer: "cus_example_1",
      success_url: "https://rank1.us/app/billing?ok=1",
      cancel_url: "https://rank1.us/app/billing",
    });
  });

  it("createCheckoutSession without a price env fails before calling Stripe", async () => {
    vi.stubEnv("STRIPE_PRICE_ID_BUSINESS", "");
    const { stripe, calls } = fakeStripe({});
    await expect(
      createCheckoutSession(stripe, { workspaceId: "w", quantity: 1, successUrl: "s", cancelUrl: "c" }),
    ).rejects.toThrow(BillingError);
    expect(calls).toEqual([]);
  });

  it("updateQuantity: +1 on the subscription item with Stripe's default proration (no proration_behavior sent)", async () => {
    const { stripe, calls } = fakeStripe({
      "GET /v1/subscriptions/sub_example_1": sub({ quantity: 2 }),
      "POST /v1/subscriptions/sub_example_1": sub({ quantity: 3 }),
    });
    expect(await updateQuantity(stripe, "sub_example_1")).toBe(3);
    const p = calls.find((c) => c.method === "POST")!.params;
    expect(Object.fromEntries(p)).toEqual({ "items[0][id]": "si_example_1", "items[0][quantity]": "3" });
  });

  it("scheduleRemoval: a schedule from the subscription, current phase to period end, next phase one less, then release", async () => {
    const schedule = {
      id: "sub_sched_example",
      object: "subscription_schedule",
      phases: [{ start_date: 1764547200, end_date: 1767225600, items: [{ price: "price_example_99", quantity: 3 }] }],
    };
    const { stripe, calls } = fakeStripe({
      "GET /v1/subscriptions/sub_example_1": sub({ quantity: 3 }),
      "POST /v1/subscription_schedules": schedule,
      "POST /v1/subscription_schedules/sub_sched_example": schedule,
    });
    expect(await scheduleRemoval(stripe, "sub_example_1")).toEqual({ periodEnd: 1767225600, nextQuantity: 2 });
    expect(Object.fromEntries(calls[1].params)).toEqual({ from_subscription: "sub_example_1" });
    expect(Object.fromEntries(calls[2].params)).toMatchObject({
      "phases[0][start_date]": "1764547200",
      "phases[0][end_date]": "1767225600",
      "phases[0][items][0][quantity]": "3",
      "phases[1][start_date]": "1767225600",
      "phases[1][items][0][quantity]": "2",
      "phases[1][items][0][price]": "price_example_99",
      end_behavior: "release",
    });
  });

  it("scheduleRemoval: a second removal lowers the already scheduled next phase again; never below 1", async () => {
    const schedule = {
      id: "sub_sched_example",
      object: "subscription_schedule",
      phases: [
        { start_date: 1764547200, end_date: 1767225600, items: [{ price: "price_example_99", quantity: 3 }] },
        { start_date: 1767225600, end_date: 1769904000, items: [{ price: "price_example_99", quantity: 2 }] },
      ],
    };
    const { stripe, calls } = fakeStripe({
      "GET /v1/subscriptions/sub_example_1": sub({ quantity: 3, schedule: "sub_sched_example" }),
      "GET /v1/subscription_schedules/sub_sched_example": schedule,
      "POST /v1/subscription_schedules/sub_sched_example": schedule,
    });
    expect((await scheduleRemoval(stripe, "sub_example_1")).nextQuantity).toBe(1);
    expect(calls.some((c) => c.method === "POST" && c.path === "/v1/subscription_schedules")).toBe(false);
    const one = fakeStripe({
      "GET /v1/subscriptions/sub_example_1": sub({ quantity: 1 }),
      "POST /v1/subscription_schedules": { ...schedule, phases: [schedule.phases[0]] },
    });
    await expect(scheduleRemoval(one.stripe, "sub_example_1")).rejects.toThrow(/at least one business/);
  });

  it("createPortalSession returns the portal URL", async () => {
    const { stripe, calls } = fakeStripe({
      "POST /v1/billing_portal/sessions": {
        id: "bps_example",
        object: "billing_portal.session",
        url: "https://billing.stripe.com/p/session/example",
      },
    });
    expect(await createPortalSession(stripe, "cus_example_1", "https://rank1.us/app/billing")).toBe(
      "https://billing.stripe.com/p/session/example",
    );
    expect(Object.fromEntries(calls[0].params)).toEqual({
      customer: "cus_example_1",
      return_url: "https://rank1.us/app/billing",
    });
  });
});
