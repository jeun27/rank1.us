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

  const BAD: [string, Record<string, unknown>][] = [
    ["address over 200", { address: "x".repeat(201) }],
    ["phone over 40", { phone: "1".repeat(41) }],
    ["category over 100", { category: "x".repeat(101) }],
    ["service_area over 200", { service_area: "x".repeat(201) }],
    ["services not an array", { services: "Drain cleaning" }],
    ["a blank service", { services: ["Drain cleaning", " "] }],
    ["a service over 100", { services: ["x".repeat(101)] }],
    ["more than 30 services", { services: Array.from({ length: 31 }, (_, i) => `Service ${i}`) }],
    ["profile_sources not an object", { profile_sources: ["schema"] }],
    ["an unknown source", { profile_sources: { phone: "llm" } }],
    ["a link that isn't http(s)", { profile_links: ["javascript:alert(1)"] }],
    ["more than 20 links", { profile_links: Array.from({ length: 21 }, (_, i) => `https://example.test/${i}`) }],
  ];
  for (const [label, patch] of BAD) {
    it(`rejects ${label} (22023) and stores nothing`, async () => {
      const { workspaceId, call } = await onboard("bp-bad", patch as Partial<OnboardingInput["business"]>);
      await expect(call()).rejects.toMatchObject({ code: "22023" });
      expect(must(await serviceClient().from("businesses").select("id").eq("workspace_id", workspaceId))).toEqual([]);
    });
  }

  it("accepts the limits at the boundary", async () => {
    const { call } = await onboard("bp-edge", {
      address: "x".repeat(200),
      phone: "1".repeat(40),
      category: "x".repeat(100),
      service_area: "x".repeat(200),
      services: Array.from({ length: 30 }, () => "x".repeat(100)),
      profile_links: Array.from({ length: 20 }, (_, i) => `http://example.test/${i}`),
    });
    expect((await row(await call())).services).toHaveLength(30);
  });
});
