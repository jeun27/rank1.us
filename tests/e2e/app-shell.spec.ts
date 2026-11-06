import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { admin, newUser, openMagicLink } from "./helpers/auth";

const STATES = [
  "dashboard-empty",
  "dashboard-unpaid",
  "dashboard-first-check",
  "dashboard-success",
  "dashboard-partial",
  "dashboard-loading",
  "dashboard-error",
  "competitors-success",
  "competitors-partial",
  "competitors-empty",
  "competitors-loading",
  "competitors-error",
  "questions-success",
  "questions-partial",
  "questions-empty",
  "questions-loading",
  "questions-error",
  "sources-success",
  "sources-partial",
  "sources-location",
  "sources-empty",
  "sources-loading",
  "sources-error",
  "fixes-success",
  "fixes-partial",
  "fixes-readonly",
  "fixes-empty",
  "fixes-loading",
  "fixes-error",
  "history-success",
  "history-partial",
  "history-empty",
  "history-loading",
  "history-error",
];

// v3: every state in both themes (the gallery follows prefers-color-scheme, like a first visit to /app).
for (const theme of ["dark", "light"] as const)
  for (const state of STATES) {
    test(`/dev/app ${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=${state}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await page.screenshot({
        path: `test-results/screenshots/app-${state}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    });
  }

test("questions drawer: keyboard opens it, Tab stays inside, Esc closes and focus returns", async ({ page }) => {
  await page.goto("/dev/app?state=questions-partial");
  const row = page.getByRole("button", { name: /best ramen in Irvine/ });
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  for (const a of await dialog.locator('a[href^="https://"]').all())
    await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("sources: the location select is keyboard reachable and lists All locations first", async ({ page }) => {
  await page.goto("/dev/app?state=sources-success");
  const select = page.getByLabel("Location");
  // focus() doesn't wait for visibility; the streamed content is hidden until React moves it into place.
  await expect(select).toBeVisible();
  await select.focus();
  await expect(select).toBeFocused();
  await expect(select.locator("option").first()).toHaveText("All locations");
  for (const a of await page.locator('main a[href^="https://"]').all())
    await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  expect(await page.locator("main").textContent()).not.toMatch(/\d%/);
});

// PRODUCT.md rule 3: every number shows n + freshness; results are "API-measured, directional".
test("rule 3 on Competitors (both widths) and History", async ({ page }) => {
  await page.goto("/dev/app?state=competitors-success");
  await expect(
    page
      .getByText(/named in 80 of 240 answers/)
      .locator("visible=true")
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Checked .* ago · \d+ answers · API-measured, directional/)).toBeVisible();
  await page.goto("/dev/app?state=history-success");
  await expect(page.getByText("API-measured, directional", { exact: true })).toBeVisible();
  await page.goto("/dev/app?state=sources-success");
  await expect(page.getByText(/Checked .* ago · \d+ answers · API-measured, directional/)).toBeVisible();
});

// Portal (b): the Status select became the check-off circle, a real checkbox.
test("fixes: each check-off circle is keyboard reachable; read-only has none", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-success");
  const selects = page.getByRole("checkbox");
  await expect(selects).toHaveCount(4);
  // focus() doesn't wait for visibility; the streamed content is hidden until React moves it into place.
  await expect(selects.first()).toBeVisible();
  await selects.first().focus();
  await expect(selects.first()).toBeFocused();
  await page.goto("/dev/app?state=fixes-readonly");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("tap targets are at least 44px on every page", async ({ page }) => {
  // v3 (lead, O2): 44px below md (UI.md); from md up the dense 32px controls apply (checked in dev-ui.spec).
  test.skip(page.viewportSize()!.width >= 768, "44px tap targets apply below md");
  for (const state of [
    "dashboard-success",
    "competitors-success",
    "questions-success",
    "sources-success",
    "history-success",
  ]) {
    await page.goto(`/dev/app?state=${state}`);
    const small = await page
      .locator("main a:visible, main button:visible")
      .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent?.trim()));
    expect(small, state).toEqual([]);
  }
});

test("signed-in owner: the nav reaches every page, one H1 each, Dashboard empty without a business", async ({
  page,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("shell");
  await openMagicLink(page, user.email);
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByText("Nothing tracked yet. Add your domain and I'll find the questions.")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "App" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Billing" }).click();
  await page.waitForURL("**/app/billing");
  await expect(nav.getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("signed-in owner: What to fix next lists open fixes, Tidy-ups, and Done removes a fix", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("fixes");
  const db = admin();
  const ws = await db
    .from("workspaces")
    .insert({ name: "Example Workspace", owner_id: user.id, subscription_status: "active", seats_quantity: 1 })
    .select("id")
    .single();
  if (ws.error) throw ws.error;
  // A trigger adds the owner as a workspace member.
  const biz = await db
    .from("businesses")
    .insert({ workspace_id: ws.data.id, name: "Example Ramen House", domain: "exampleramen.test" })
    .select("id")
    .single();
  if (biz.error) throw biz.error;
  const fixes = await db
    .from("fixes")
    .insert([
      {
        business_id: biz.data.id,
        rule_key: "R10",
        size: "M-L",
        title: "Example data: put your menu on a page as text",
      },
      { business_id: biz.data.id, rule_key: "H1", size: "S", title: "Example data: add Restaurant schema" },
    ])
    .select("id, rule_key");
  if (fixes.error) throw fixes.error;

  await openMagicLink(page, user.email);
  await page.goto("/app/fixes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What to fix next");
  // G5: real fixes carry their rule's pillar, so the list is grouped. R10 is P5 (an H2 group with the fix
  // as H3), and the H1 tidy-up sits in Tidy-ups inside P2.
  const p5 = page.getByRole("region", { name: "P5: Technical access" });
  await expect(p5.getByRole("heading", { level: 2, name: "P5: Technical access" })).toBeVisible();
  await expect(
    p5.getByRole("heading", { level: 3, name: "Example data: put your menu on a page as text" }),
  ).toBeVisible();
  const tidy = page.getByRole("region", { name: "P2: Content" }).getByRole("region", { name: "Tidy-ups" });
  await expect(tidy.getByRole("heading", { name: "Example data: add Restaurant schema" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "What to fix next" }),
  ).toHaveAttribute("aria-current", "page");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Done closes the fix: it leaves the list and the row is saved.
  const r10 = fixes.data.find((f) => f.rule_key === "R10")!;
  await page.getByRole("listitem").filter({ hasText: "put your menu" }).getByRole("checkbox").click();
  await expect(page.getByText("Example data: put your menu on a page as text")).toHaveCount(0);
  // The circle is optimistic (the row moves at once), so wait for the save itself to land.
  await expect
    .poll(async () => (await db.from("fixes").select("status").eq("id", r10.id).single()).data?.status)
    .toBe("done");
});

// QA STEP 9 (#49): the selector is a plain GET form submitted by its Show button (the form markup is
// unit-tested). Streamed /app pages need JavaScript to reveal their content, so this runs with JS on.
test("sources location form: Show submits ?location= and the choice is kept; All locations clears it", async ({
  page,
}) => {
  await page.goto("/dev/app?state=sources-form");
  const select = page.getByLabel("Location");
  const second = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(second!);
  expect(page.url()).not.toContain("location=");
  await page.getByRole("button", { name: "Show" }).click();
  await page.waitForURL(/location=/);
  expect(new URL(page.url()).searchParams.get("location")).toBe(second);
  await expect(page.getByLabel("Location")).toHaveValue(second!);
  await page.getByLabel("Location").selectOption("");
  await page.getByRole("button", { name: "Show" }).click();
  await page.waitForURL((u) => u.searchParams.get("location") === "");
  await expect(page.getByLabel("Location")).toHaveValue("");
});

// QA #58: the fixes gallery's n is the Dashboard gallery's n (one run, one count).
test("fixes gallery freshness n equals the Dashboard gallery n", async ({ page }) => {
  const n = async (state: string) => {
    await page.goto(`/dev/app?state=${state}`);
    const t = await page
      .getByText(/\d[\d,]* answers ·/)
      .first()
      .textContent();
    return t?.match(/(\d[\d,]*) answers/)?.[1];
  };
  const dashboard = await n("dashboard-success");
  expect(dashboard).toBeDefined();
  expect(await n("fixes-success")).toBe(dashboard);
});

// X6 (UI.md D33): the page name renders 22/28 at -0.02em at every width, and the hero number is 44/48.
test("/dev/app dashboard: the H1 is 22/28 -0.02em and the hero number is 44px", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCSS("font-size", "22px");
  await expect(h1).toHaveCSS("line-height", "28px");
  await expect(h1).toHaveCSS("letter-spacing", "-0.44px");
  await expect(page.locator("main p.text-hero").first()).toHaveCSS("font-size", "44px");
});

// X9b (UI.md Chart): axis labels are a fixed 10.5px at every width (they were about 7px at 375), and each
// y label sits on its grid line.
test("/dev/app dashboard: chart axis labels are 10.5px and line up with the grid", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const labels = page.locator("[data-axis]");
  await expect(labels).toHaveCount(5);
  for (const size of await labels.evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize)))
    expect(size).toBe("10.5px");
  const [lineTops, labelMids] = await page.evaluate(() => [
    [...document.querySelectorAll("svg line")].map((l) => l.getBoundingClientRect().top),
    [...document.querySelectorAll("[data-axis]")]
      .slice(0, 3)
      .map((e) => e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2),
  ]);
  for (const [i, mid] of labelMids.entries()) expect(Math.abs(mid - lineTops[i])).toBeLessThanOrEqual(1.5);
});

// X8 (UI.md Table, D43): at 375 the leaderboard stacks; the You row comes first and its result is on screen.
for (const path of ["/dev/app?state=competitors-success", "/dev/app?state=dashboard-success", "/dev/audit"])
  test(`${path}: phones pin the You row first with its result visible, no side scroll`, async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "the stacked table is the phone layout");
    await page.goto(path);
    const table = page.getByRole("table", { name: "Competitors" }).first();
    const rows = table.locator("tbody tr");
    const tops = await rows.evaluateAll((trs) => trs.map((tr) => tr.getBoundingClientRect().top));
    const you = rows.filter({ hasText: "You" });
    const youTop = (await you.boundingBox())!.y;
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(youTop - 1);
    const result = you.locator("td").nth(1);
    const box = (await result.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect((await you.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
// X1 (UX plan L1): the next fix is on the first screen at 375 and 1280, and its one link opens that fix.
test("/dev/app dashboard: the next-fix card is in the first viewport", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const card = page.getByRole("region", { name: "What to fix next" });
  const box = (await card.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(card.getByRole("link", { name: "What to fix next" })).toHaveAttribute("href", "/app/fixes#fix-f1");
});
