import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { CUISINES } from "@/lib/onboarding/cuisines";

const STATES = [
  "1 empty",
  "1 loading",
  "2 error",
  "2 partial",
  "2 success",
  "3 loading",
  "3 success",
  "3 partial",
  "3 empty",
  "3 error",
  "4 success",
  "4 error",
];

test("/dev/onboarding shows every 4b onboarding state, accessibly", async ({ page }, info) => {
  await page.goto("/dev/onboarding");
  const state = (name: string) => page.locator(`[data-state="${name}"]`);
  await expect(page.locator("[data-state]")).toHaveCount(STATES.length);

  await expect(state("1 loading").getByText("Reading your site…")).toBeVisible();
  await expect(
    state("2 error").getByRole("group", { name: "We couldn't read that site. Type 3 things you sell." }),
  ).toBeVisible();
  await expect(state("2 partial").getByLabel("Cuisine")).toHaveAttribute("data-attention", "true");
  // The select lists CUISINES (#23), the same list the real page passes.
  const options = await state("2 success").getByLabel("Cuisine").locator("option").allTextContents();
  expect(options).toEqual(["", ...CUISINES]);
  await expect(state("3 loading").getByText("Finding ramen places in Irvine…")).toBeVisible();
  await expect(state("3 success").getByRole("checkbox", { name: /Example/ })).toHaveCount(5);
  await expect(state("3 partial").getByText("Add competitors by name.", { exact: true })).toBeVisible();
  await expect(
    state("3 empty").getByText("No local ramen places found near Irvine. Add competitors by name."),
  ).toBeVisible();
  await expect(state("3 error").getByText("Couldn't load nearby places. Add competitors by name.")).toBeVisible();
  // X23: 25 one-line rows; a row opens its editor when tapped.
  await expect(state("4 success").getByRole("group", { name: /^\d+$/ })).toHaveCount(25);
  await expect(state("4 success").getByLabel("Short form")).toHaveCount(0);

  // Partial and error states of step 3 come from the user's own actions.
  await state("4 success").getByRole("group", { name: "7", exact: true }).locator("[aria-expanded]").click();
  await state("4 success").getByLabel("Short form").fill("");
  await state("4 success").getByRole("button", { name: "Finish setup" }).click();
  await expect(state("4 success").getByText("Couldn't save question 7: it's empty.")).toBeVisible();
  await expect(state("4 success").getByText("Edited")).toHaveCount(1);
  await state("4 error").getByRole("button", { name: "Finish setup" }).click();
  await expect(state("4 error").getByRole("alert")).toHaveText("We couldn't save your business. Try again.");

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

  for (const name of STATES)
    await state(name).screenshot({
      path: `test-results/screenshots/onboarding-${name.replace(" ", "-")}-${info.project.name}.png`,
    });
});
