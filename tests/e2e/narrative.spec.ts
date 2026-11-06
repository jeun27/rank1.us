import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G4 "How AI describes you" on Example data (lead OK 2026-11-06): the Dashboard's clash card (snippet + Word
// match + Edit words) and quiet no-words line, and Settings → How should AI describe you?
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};

for (const theme of ["dark", "light"] as const) {
  test(`Dashboard ${theme}: the clash card after the next-fix card, the word marked; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=dashboard-narrative-clash");
    const card = page.getByRole("region", { name: "How AI describes you" });
    await expect(card).toContainText("6 of 48 answers use words you want to avoid: cheap");
    await expect(card.locator("mark")).toHaveText("cheap");
    await expect(card).toContainText("Word match");
    await expect(card.getByRole("link", { name: "Edit words" })).toHaveAttribute("href", "/app/settings/narrative");
    await axeClean(page);
    await card.screenshot({ path: `test-results/screenshots/narrative-card-${theme}-${info.project.name}.png` });
  });

  test(`Settings ${theme}: the two lists with counts, add and remove, inline errors; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=settings-narrative");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How should AI describe you?");
    const want = page.getByRole("group", { name: "Words that fit you" });
    await expect(want.getByRole("listitem").filter({ hasText: "fresh" })).toContainText("in 20 of 48 answers");
    await expect(want.getByRole("listitem").filter({ hasText: "handmade noodles" })).toContainText("not yet");
    await axeClean(page);
    await page.screenshot({
      path: `test-results/screenshots/narrative-settings-${theme}-${info.project.name}.png`,
      fullPage: true,
    });
    const avoid = page.getByRole("group", { name: "Words to avoid" });
    await avoid.getByRole("textbox").fill("fresh");
    await avoid.getByRole("button", { name: "Add" }).click();
    await expect(avoid.getByRole("textbox")).toHaveAccessibleDescription("That word is in the other list.");
    await avoid.getByRole("button", { name: "Remove cheap" }).click();
    await expect(avoid.getByText("cheap")).toHaveCount(0);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  });
}

test("Dashboard, no words yet: one quiet line with Add your words, no card", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-narrative-nowords");
  await expect(
    page.getByText("Tell us the words that fit you, and we'll check every AI answer for them."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Add your words" })).toHaveAttribute("href", "/app/settings/narrative");
  await expect(page.getByRole("region", { name: "How AI describes you" })).toHaveCount(0);
  await axeClean(page);
});

test("Settings, no clash: the no-clash line", async ({ page }) => {
  await page.goto("/dev/app?state=settings-narrative-noclash");
  await expect(page.getByText('No clashes. None of your "avoid" words came up.')).toBeVisible();
});
