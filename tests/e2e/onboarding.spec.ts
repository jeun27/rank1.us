import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { admin, newUser, openMagicLink } from "./helpers/auth";

const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

// Next is the one primary button on each screen; on phones it sits in the sticky bar.
const next = (page: Page) => page.getByRole("button", { name: "Next" });
// UI1: the step shows in the rail at md+, and in the phone line/bar below md.
const STEPS = ["Your site", "Your business", "Competitors", "Questions"];
const onStep = async (page: Page, n: number) =>
  page.viewportSize()!.width >= 768
    ? expect(page.getByRole("list", { name: "Add your business" }).locator('[aria-current="step"]')).toContainText(
        STEPS[n - 1],
      )
    : expect(page.getByText(`Step ${n} of 4 · ${STEPS[n - 1]}`)).toBeVisible();

test("a new owner sets up a business in 3 steps and lands on /app", async ({ page }, info) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  test.setTimeout(90_000);
  const user = await newUser("onboarding");
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add your business");
  await onStep(page, 1);
  await axeClean(page);
  await page.screenshot({ path: `test-results/screenshots/onboarding-1-empty-${info.project.name}.png` });

  // A .test domain never resolves, so the site read fails the way a real unreadable site does.
  await page.getByLabel("Your website").fill("exampleramen.test");
  await page.getByLabel("Your website").press("Enter");
  await expect(page.getByText("We couldn't read that site. Fill in your business below.")).toBeVisible({
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
  await onStep(page, 3);
  await expect(page.getByText("Couldn't load nearby places. Add competitors by name.")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Name").fill("Example Noodle Bar");
  await page.getByLabel("Domain").fill("examplenoodle.test");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await expect(page.getByRole("checkbox", { name: "Example Noodle Bar" })).toBeChecked();
  await axeClean(page);
  await next(page).click();

  await onStep(page, 4);
  await expect(page.getByRole("group", { name: /^\d+$/ })).toHaveCount(25);
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
  // Typing before hydration would submit the plain form and reload; wait for the client form.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your website").focus();
  await page.keyboard.type("exampleramen");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Add the ending, like ramenhouse.com")).toBeVisible();
  await expect(page.getByLabel("Your website")).toBeFocused();
  await page.keyboard.type(".test");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Business name")).toBeFocused({ timeout: 20_000 });
});

test("tap targets are at least 44px on every step", async ({ page }) => {
  // v3 (lead, O2): 44px below md (UI.md); from md up the dense 32px controls apply (checked in dev-ui.spec).
  test.skip(page.viewportSize()!.width >= 768, "44px tap targets apply below md");
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
  await page.getByLabel("Your website").fill("exampleramen.test");
  await page.getByLabel("Your website").press("Enter");
  await page.getByLabel("Business name").fill("Example Ramen House", { timeout: 20_000 });
  await page.getByLabel("Cuisine").selectOption("ramen");
  expect(await small()).toEqual([]);
});

// X23 (UX plan PR 26b): step 3 is 25 one-line rows, not ~9,900px of open editors; the count + Finish bar
// stays at the bottom of the screen while the list scrolls.
test("step 3: one-line rows and a sticky count + Finish bar", async ({ page }) => {
  await page.goto("/dev/onboarding");
  const step3 = page.locator('[data-state="4 success"]');
  await expect(step3.getByRole("group", { name: /^\d+$/ })).toHaveCount(25);
  const list = (await step3.locator("ol").boundingBox())!;
  expect(list.height).toBeLessThan(page.viewportSize()!.width < 768 ? 2600 : 1800);
  for (const h of await step3
    .getByRole("group", { name: /^\d+$/ })
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
    expect(h).toBeLessThan(120);
  await step3.getByRole("group", { name: "12", exact: true }).scrollIntoViewIfNeeded();
  const bar = step3.getByText(/^\d+ of \d+ questions tracked$/);
  await expect(bar).toBeInViewport();
  await expect(step3.getByRole("button", { name: "Finish setup" })).toBeInViewport();
  const box = (await step3.getByRole("button", { name: "Finish setup" }).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

// OB2: one H1 at the app title size (22px, like every app page), and step 1 has no second heading.
test("onboarding has one app-sized H1 and no 'Business' H2", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("onboarding-heading");
  await openMagicLink(page, user.email);
  await page.goto("/app/onboarding");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Add your business");
  expect(await h1.evaluate((e) => getComputedStyle(e).fontSize)).toBe("22px");
  await expect(page.getByRole("heading", { level: 2, name: "Business" })).toHaveCount(0);
  await onStep(page, 1);
});

// UI1 (O1 welcome): one visible "Read my site" in the first viewport (the field's at md+, the sticky bar's
// on phones), the Example panel beside or below the task, no "Step n" eyebrow above the H1.
test("the welcome step: one primary in the first viewport, and the Example panel", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("onboarding-welcome");
  await openMagicLink(page, user.email);
  await page.goto("/app/onboarding");
  const read = page.getByRole("button", { name: "Read my site" }).locator("visible=true");
  await expect(read).toHaveCount(1);
  await expect(read).toBeInViewport();
  await expect(page.getByLabel("Your website")).toBeInViewport();
  const phone = page.viewportSize()!.width < 768;
  if (phone) expect((await read.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("figure", { name: "What you'll see after your first check" })).toBeVisible();
  await expect(page.getByText("Example data")).toBeVisible();
  await expect(page.getByText(/^Step \d of/).locator("visible=true")).toHaveCount(phone ? 1 : 0);
  await axeClean(page);
});

// #203 review B1: "No website? Fill it in yourself" must reach /app. The owner has no domain, so the
// business is saved with domain null (never "" or a made-up placeholder).
test("no website: fill the card, finish, and the business is saved without a domain", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  test.setTimeout(90_000);
  const user = await newUser("onboarding-nosite");
  await openMagicLink(page, user.email);
  await page.getByRole("button", { name: "No website? Fill it in yourself" }).click();
  await page.getByLabel("Business name").fill("Example Ramen House");
  await page.getByLabel("Cuisine").selectOption("ramen");
  await next(page).click();
  await expect(page.getByText("Couldn't load nearby places. Add competitors by name.")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Name").fill("Example Noodle Bar");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await next(page).click();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL("**/app", { timeout: 20_000 });

  const db = admin();
  const { data: member } = await db.from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
  const { data: biz } = await db.from("businesses").select("name, domain").eq("workspace_id", member!.workspace_id);
  expect(biz).toEqual([{ name: "Example Ramen House", domain: null }]);
});

// OB1: the onboarding breadcrumb reads "Rank1 / Add your business" (one separator), never "Rank1 / /".
test("the onboarding breadcrumb has no empty crumbs", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("onboarding-crumbs");
  await openMagicLink(page, user.email);
  await page.goto("/app/onboarding");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByText("Add your business")).toBeVisible();
  const shown = await crumbs.locator("li").evaluateAll((lis) =>
    lis
      .filter((li) => getComputedStyle(li).display !== "none")
      .map((li) => {
        // A separator counts only when it's drawn: display:none keeps the "/" content but hides it.
        const b = getComputedStyle(li, "::before");
        return { text: li.textContent?.trim(), sep: b.content.includes("/") && b.display !== "none" };
      }),
  );
  const phone = page.viewportSize()!.width < 768;
  expect(shown.map((c) => c.text)).toEqual(phone ? ["Add your business"] : ["Rank1", "Add your business"]);
  expect(shown.filter((c) => c.sep)).toHaveLength(phone ? 0 : 1);
});
