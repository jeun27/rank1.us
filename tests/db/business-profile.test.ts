import { describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, type OnboardingInput } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient } from "./helpers";

// 0041: the onboarding v2 profile fields (read from the site, all optional). create_business_onboarding
// stores them; without them the row gets the defaults, so the live build is unaffected.
const PROFILE = "address, phone, category, services, service_area, profile_sources, profile_links";

const input = (extra: Partial<OnboardingInput["business"]> = {}): OnboardingInput => ({
  business: {
    name: "Example Plumbing Co",
    domain: "example-plumbing.test",
    cuisine: null,
    vertical: "plumbing",
    city: "Irvine",
    state: "CA",
    country: "US",
    aliases: [],
    ...extra,
  },
  competitors: [],
  questions: [],
});

async function onboard(tag: string, extra: Partial<OnboardingInput["business"]> = {}) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  return { user, workspaceId, call: () => createBusinessOnboarding(user.db, input(extra)) };
}
const row = async (id: string) => must(await serviceClient().from("businesses").select(PROFILE).eq("id", id).single());

const CHECK = "23514";

describe("business profile fields", () => {
  it("stores every profile field when given", async () => {
    const fields: Partial<OnboardingInput["business"]> = {
      address: "1 Example St, 92618",
      phone: "+1 949 555 0100",
      category: "Plumber",
      services: ["Water heater repair", "Drain cleaning"],
      service_area: "Irvine and nearby cities",
      profile_sources: { address: "schema", services: "nav", service_area: "default", category: "user" },
      profile_links: ["https://www.yelp.com/biz/example", "https://www.youtube.com/@example"],
    };
    const { call } = await onboard("bp-full", fields);
    expect(await row(await call())).toEqual(fields);
  });

  it("without them: nulls, empty arrays and an empty sources object", async () => {
    const { call } = await onboard("bp-none");
    expect(await row(await call())).toEqual({
      address: null,
      phone: null,
      category: null,
      services: [],
      service_area: null,
      profile_sources: {},
      profile_links: [],
    });
  });

  // The table's CHECK refuses values outside the rules (23514); a non-array services fails to parse (22023).
  const BAD: [string, Record<string, unknown>, string][] = [
    ["address over 200", { address: "x".repeat(201) }, CHECK],
    ["phone over 40", { phone: "1".repeat(41) }, CHECK],
    ["category over 100", { category: "x".repeat(101) }, CHECK],
    ["service_area over 200", { service_area: "x".repeat(201) }, CHECK],
    ["services not an array", { services: "Drain cleaning" }, "22023"],
    ["a blank service", { services: ["Drain cleaning", " "] }, CHECK],
    ["a service over 100", { services: ["x".repeat(101)] }, CHECK],
    ["more than 30 services", { services: Array.from({ length: 31 }, (_, i) => `Service ${i}`) }, CHECK],
    ["profile_sources not an object", { profile_sources: ["schema"] }, CHECK],
    ["an unknown source", { profile_sources: { phone: "llm" } }, CHECK],
    ["a javascript: link", { profile_links: ["javascript:alert(1)"] }, CHECK],
    ["an http (not https) link", { profile_links: ["http://www.yelp.com/biz/example"] }, CHECK],
    ["more than 20 links", { profile_links: Array.from({ length: 21 }, (_, i) => `https://example.test/${i}`) }, CHECK],
  ];
  for (const [label, patch, code] of BAD) {
    it(`rejects ${label} (${code}) and stores nothing`, async () => {
      const { workspaceId, call } = await onboard("bp-bad", patch as Partial<OnboardingInput["business"]>);
      await expect(call()).rejects.toMatchObject({ code });
      expect(must(await serviceClient().from("businesses").select("id").eq("workspace_id", workspaceId))).toEqual([]);
    });
  }

  it("a member's direct UPDATE gets the same rules: a bad value is refused, a good one is stored", async () => {
    const { user, call } = await onboard("bp-update");
    const id = await call();
    for (const bad of [
      { profile_links: ["javascript:alert(1)"] },
      { profile_sources: { phone: "llm" } },
      { services: Array.from({ length: 31 }, (_, i) => `Service ${i}`) },
      { phone: "1".repeat(41) },
    ]) {
      const res = await user.db.from("businesses").update(bad).eq("id", id);
      expect(res.error?.code, JSON.stringify(bad)).toBe(CHECK);
    }
    const good = {
      profile_links: ["https://www.yelp.com/biz/example"],
      profile_sources: { phone: "user" },
      services: ["Drain cleaning"],
      phone: "+1 949 555 0100",
    };
    must(await user.db.from("businesses").update(good).eq("id", id));
    expect(await row(id)).toMatchObject(good);
  });

  it("accepts the limits at the boundary", async () => {
    const { call } = await onboard("bp-edge", {
      address: "x".repeat(200),
      phone: "1".repeat(40),
      category: "x".repeat(100),
      service_area: "x".repeat(200),
      services: Array.from({ length: 30 }, () => "x".repeat(100)),
      profile_links: Array.from({ length: 20 }, (_, i) => `https://example.test/${i}`),
    });
    expect((await row(await call())).services).toHaveLength(30);
  });
});
