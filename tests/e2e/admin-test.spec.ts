import { test, expect, type Page } from "@playwright/test";
import { adminCopy as c } from "@/lib/admin/copy";
import { E2E_FOUNDER_EMAIL } from "./helpers/admin";
import { admin, newUser, openMagicLink } from "./helpers/auth";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// The founder account. Both viewport projects create it at once, so "already exists" is fine.
async function founder() {
  const { error } = await admin().auth.admin.createUser({ email: E2E_FOUNDER_EMAIL, email_confirm: true });
  if (!error) return;
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  if (!data.users.some((u) => u.email === E2E_FOUNDER_EMAIL)) throw error;
}

// Only one magic link per user is valid, and both projects sign the founder in at once, so retry.
async function signInFounder(page: Page) {
  for (let i = 0; i < 5; i++) {
    await openMagicLink(page, E2E_FOUNDER_EMAIL);
    const res = await page.goto("/admin/test");
    if (res?.status() === 200) return res;
    await page.waitForTimeout(500 + Math.random() * 1000);
  }
  throw new Error("founder sign-in did not stick");
}

async function run(page: Page, engine: string, level: string) {
  await page.getByLabel(c.engineLabel).selectOption({ label: engine });
  await page.getByLabel(c.questionLabel).fill("best ramen in Irvine");
  await page.getByLabel(c.levelLabel).selectOption({ label: level });
  await page.getByRole("button", { name: c.run }).click();
  await expect(page.getByText(c.status, { exact: true })).toBeVisible();
}

test("signed out: /admin/test is a 404", async ({ page }) => {
  const res = await page.goto("/admin/test");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: c.title })).toHaveCount(0);
});

test("another signed-in user gets a 404", async ({ page }) => {
  const u = await newUser("not-founder");
  await openMagicLink(page, u.email);
  const res = await page.goto("/admin/test");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: c.title })).toHaveCount(0);
});

test("the founder sees the form and runs engines against the fake API", async ({ page }) => {
  await founder();
  expect((await signInFounder(page)).status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.title);
  await expect(page.getByText(/Missing API keys/)).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectAxeClean(page);

  await run(page, "Perplexity", "City");
  await expect(page.getByLabel(c.engineLabel)).toHaveValue("perplexity");
  await expect(page.getByLabel(c.questionLabel)).toHaveValue("best ramen in Irvine");
  const result = page.locator("dl");
  await expect(result).toContainText("ok");
  await expect(result).toContainText(`${c.exact} · Irvine, California, United States`);
  await expect(result.getByRole("listitem")).toHaveCount(3);
  await expect(result).toContainText("0.0061");

  await run(page, "ChatGPT", "City");
  await expect(result).toContainText(`${c.fallback} · US`);
  await expect(result.getByRole("listitem")).toHaveCount(3);
  await expectNoSideScroll(page);
  await expectAxeClean(page);
});
