import { test, expect, type Locator, type Page } from "@playwright/test";

// QA v0.8.0 (#179): standalone text links are 44px targets below md, in both themes. Links inside a sentence
// are exempt. Each case: a /dev/app state and the standalone links on it.
const CASES: { state: string; links: (page: Page) => Locator[] }[] = [
  {
    state: "onboarding-connect",
    links: (page) => [page.getByRole("link", { name: "Skip for now" })],
  },
  {
    state: "dashboard-narrative-clash",
    links: (page) => [page.getByRole("link", { name: "Edit words" })],
  },
  {
    state: "fixes-mentions",
    links: (page) => {
      const r17 = page.getByRole("checkbox", { name: "Get on these lists" }).locator("xpath=ancestor::li[1]");
      return [r17.getByRole("link", { name: "The OC noodle guide" }), r17.getByRole("link", { name: "+1 more" })];
    },
  },
  {
    state: "fixes-youtube",
    links: (page) => [
      page
        .getByRole("checkbox", { name: "Put your keyword in your video titles" })
        .locator("xpath=ancestor::li[1]")
        .locator("[data-video] a")
        .first(),
    ],
  },
];

for (const theme of ["dark", "light"] as const)
  for (const { state, links } of CASES)
    test(`${state} (${theme}): standalone links are at least 44px tall at 375`, async ({ page }) => {
      test.skip(page.viewportSize()!.width >= 768, "below md only");
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=${state}`);
      for (const link of links(page)) {
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height, await link.innerText()).toBeGreaterThanOrEqual(44);
      }
    });
