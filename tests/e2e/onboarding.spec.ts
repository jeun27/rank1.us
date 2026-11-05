import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { admin, newUser, openMagicLink } from "./helpers/auth";

const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

// Next is the one primary button on each screen; on phones it sits in the sticky bar.
const next = (page: Page) => page.getByRole("button", { name: "Next" });

test("a new owner sets up a business in 3 steps and lands on /app", async ({ page }, info) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  test.setTimeout(90_000);
  const user = await newUser("onboarding");
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add your business");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await axeClean(page);
  await page.screenshot({ path: `test-results/screenshots/onboarding-1-empty-${info.project.name}.png` });

  // A .test domain never resolves, so the site read fails the way a real unreadable site does.
  await page.getByLabel("Your domain").fill("exampleramen.test");
  await page.getByLabel("Your domain").press("Enter");
  await expect(page.getByRole("group", { name: "We couldn't read that site. Type 3 things you sell." })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Business name").fill("Example Ramen House");
  await page.getByLabel("Cuisine").selectOption("ramen");
  await expect(page.getByLabel("City")).toHaveValue("Irvine");
  await expect(page.getByLabel("State")).toHaveValue("CA");
  for (const name of [
    "Diamond Jamboree",
    "Irvine Spectrum Center",
    "UC Irvine",
    "Northwood",
    "Turtle Rock",
    "Woodbridge",
    "vegan",
    "vegetarian",
    "date night",
  ])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await axeClean(page);
  await next(page).click();

  // No DataForSEO keys in CI: the lookup reports missing keys and the manual form takes over.
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByText("Couldn't load nearby places. Add competitors by name.")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Name").fill("Example Noodle Bar");
  await page.getByLabel("Domain").fill("examplenoodle.test");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await expect(page.getByRole("checkbox", { name: "Example Noodle Bar" })).toBeChecked();
  await axeClean(page);
  await next(page).click();

  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByLabel("Short form")).toHaveCount(25);
  await axeClean(page);
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL("**/app", { timeout: 20_000 });

  const db = admin();
  // businesses has no FK to workspace_members, so look the workspace up first.
  const { data: member } = await db.from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
  const { data: biz, error } = await db
    .from("businesses")
    .select("id, name, domain, cuisine, city, state")
    .eq("workspace_id", member!.workspace_id);
  expect(error).toBeNull();
  expect(biz).toHaveLength(1);
  expect(biz![0]).toMatchObject({
    name: "Example Ramen House",
    domain: "exampleramen.test",
    cuisine: "ramen",
    city: "Irvine",
    state: "CA",
  });
  const { count: questions } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", biz![0].id)
    .eq("active", true);
  expect(questions).toBe(25);
  const { data: comps } = await db.from("competitors").select("name, domain, source").eq("business_id", biz![0].id);
  expect(comps).toEqual([{ name: "Example Noodle Bar", domain: "examplenoodle.test", source: "manual" }]);
});

test("keyboard only: the domain step submits with Enter and focus lands on the next field", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("onboarding-keys");
  await openMagicLink(page, user.email);
  await page.getByLabel("Your domain").focus();
  await page.keyboard.type("exampleramen");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Add the ending, like ramenhouse.com")).toBeVisible();
  await expect(page.getByLabel("Your domain")).toBeFocused();
  await page.keyboard.type(".test");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Business name")).toBeFocused({ timeout: 20_000 });
});

test("tap targets are at least 44px on every step", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("onboarding-tap");
  await openMagicLink(page, user.email);
  const small = () =>
    page
      .locator("main button:visible, main a:visible, main label:has(input[type=checkbox]):visible, main select:visible")
      .evaluateAll((els) =>
        els
          .map((e) => ({
            t: e.getAttribute("aria-label") ?? e.textContent?.trim() ?? e.id,
            r: e.getBoundingClientRect(),
          }))
          .filter((x) => x.r.height < 44)
          .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
      );
  expect(await small()).toEqual([]);
  await page.getByLabel("Your domain").fill("exampleramen.test");
  await page.getByLabel("Your domain").press("Enter");
  await page.getByLabel("Business name").fill("Example Ramen House", { timeout: 20_000 });
  await page.getByLabel("Cuisine").selectOption("ramen");
  expect(await small()).toEqual([]);
});
