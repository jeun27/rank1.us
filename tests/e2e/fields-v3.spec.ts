import { test, expect, type Locator, type Page } from "@playwright/test";

// Lead (2026-11-06): one v3 field everywhere. PillField on every form that uses it, plus the selects beside
// it (onboarding Cuisine, contact Tier): radius 6, 44px tall below md and 36px from md, in both themes.
const FORMS: { name: string; open: (page: Page) => Promise<Locator> }[] = [
  {
    name: "signin",
    open: async (page) => {
      await page.goto("/signin");
      return page.getByLabel("Email");
    },
  },
  {
    name: "contact",
    open: async (page) => {
      await page.goto("/contact");
      return page.getByLabel("Name");
    },
  },
  {
    name: "onboarding",
    open: async (page) => {
      await page.goto("/dev/onboarding");
      return page.locator('[data-state="1 success"]').getByLabel("Business name");
    },
  },
  {
    name: "onboarding-select",
    open: async (page) => {
      await page.goto("/dev/onboarding");
      return page.locator('[data-state="1 success"]').getByLabel("Cuisine");
    },
  },
  {
    name: "contact-select",
    open: async (page) => {
      await page.goto("/contact");
      return page.getByLabel("Tier");
    },
  },
  {
    name: "competitors",
    open: async (page) => {
      await page.goto("/dev/app?state=competitors-success");
      // X26: with competitors tracked, the add form is folded behind "Add competitor".
      await page.getByText("Add competitor", { exact: true }).first().click();
      return page.getByLabel("Domain", { exact: true });
    },
  },
  {
    name: "team-clients",
    open: async (page) => {
      await page.goto("/dev/team");
      await page.getByRole("button", { name: /^Client / }).click();
      await page.getByRole("button", { name: "Clients", exact: true }).click();
      if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Document", exact: true }).click();
      return page.getByRole("tabpanel").getByLabel("Email");
    },
  },
];

for (const theme of ["dark", "light"] as const)
  for (const f of FORMS)
    test(`${f.name} ${theme}: the v3 field (radius 6, 44px below md, 36px from md)`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      const input = await f.open(page);
      await expect(input).toBeVisible();
      // A select is its own box; an input sits in PillField's box.
      const box = (await input.evaluate((el) => el.tagName)) === "SELECT" ? input : input.locator("xpath=..");
      expect(await box.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("6px");
      const want = page.viewportSize()!.width < 768 ? 44 : 36;
      expect(Math.round((await input.boundingBox())!.height)).toBe(want);
      if (f.name.endsWith("-select")) return;
      await input.locator("xpath=ancestor::form[1]").screenshot({
        path: `test-results/screenshots/fields-${f.name}-${theme}-${info.project.name}.png`,
      });
    });
