import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { admin, newUser, openMagicLink } from "./helpers/auth";

// Step 11: /team on real data, read through RLS. Needs the local stack's service-role key to seed.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const isMobile = (page: Page) => page.viewportSize()!.width < 768;
const show = async (page: Page, pane: "Nav" | "Context" | "Document") => {
  if (isMobile(page)) await page.getByRole("tab", { name: pane, exact: true }).click();
};
const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

// A workspace with one active business (DFY or self-serve) owned by a fresh user.
async function seedBusiness(service: "dfy" | "self_serve", name: string) {
  const owner = await newUser(`owner-${service}`);
  const ws = must(
    await admin()
      .from("workspaces")
      .insert({ name: "Example Workspace", owner_id: owner.id, subscription_status: "active", seats_quantity: 1 })
      .select("id")
      .single(),
  );
  return must(
    await admin()
      .from("businesses")
      .insert({ workspace_id: ws.id, name, service, domain: "exampleramen.test" })
      .select("id")
      .single(),
  ).id;
}

test("team sees a DFY client on real data, writes its fix status, and never a self-serve business", async ({
  page,
  context,
}) => {
  const tag = randomUUID().slice(0, 8);
  const dfyName = `Example DFY Ramen ${tag}`;
  const selfName = `Example Self-serve Noodles ${tag}`;
  const dfy = await seedBusiness("dfy", dfyName);
  const selfServe = await seedBusiness("self_serve", selfName);
  const fix = must(
    await admin()
      .from("fixes")
      .insert({
        business_id: dfy,
        rule_key: "R14",
        size: "S",
        title: "robots.txt allows AI search crawlers",
        detail: "Your robots.txt blocks OAI-SearchBot from /menu. Check if you meant to.",
      })
      .select("id")
      .single(),
  );

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openMagicLink(page, (await newUser("team-real", "team")).email);
  const res = await page.goto(`/team?b=${dfy}`);
  expect(res?.status()).toBe(200);

  // The Client switcher lists DFY clients only, with the selected one chosen.
  await show(page, "Context");
  const client = page.getByLabel("Client");
  await expect(client).toHaveValue(dfy);
  await expect(client.locator("option", { hasText: dfyName })).toHaveCount(1);
  await expect(client.locator("option", { hasText: selfName })).toHaveCount(0);
  await expect(page.getByText("Example data")).toHaveCount(0);

  // Copy context is the stored-data brief for this client.
  await page.getByRole("button", { name: "Copy context" }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain(dfyName);
  expect(brief).toContain("API-measured, directional");
  expect(brief).toContain("robots.txt allows AI search crawlers");

  // Fix list: the shared FixList; Done saves through set_fix_status.
  await show(page, "Nav");
  await page.locator("nav").getByRole("button", { name: "Fix list", exact: true }).first().click();
  await show(page, "Document");
  const card = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "robots.txt allows" });
  await expect(card).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await card.getByLabel("Status").selectOption("done");
  await expect
    .poll(async () => must(await admin().from("fixes").select("status").eq("id", fix.id).single()).status)
    .toBe("done");

  // A self-serve business or an unknown id is a real 404, not a page that streams a 200.
  expect((await page.goto(`/team?b=${selfServe}`))?.status()).toBe(404);
  expect((await page.goto(`/team?b=${randomUUID()}`))?.status()).toBe(404);
  expect((await page.goto("/team?b=not-a-uuid"))?.status()).toBe(404);
});
