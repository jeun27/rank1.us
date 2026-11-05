import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATES = [
  "1 empty",
  "1 loading",
  "1 error",
  "1 partial",
  "1 success",
  "2 loading",
  "2 success",
  "2 partial",
  "2 empty",
  "2 error",
  "3 success",
  "3 error",
];

test("/dev/onboarding shows every 4b onboarding state, accessibly", async ({ page }, info) => {
  await page.goto("/dev/onboarding");
  const state = (name: string) => page.locator(`[data-state="${name}"]`);
  await expect(page.locator("[data-state]")).toHaveCount(STATES.length);

  await expect(state("1 loading").getByText("Reading your site…")).toBeVisible();
  await expect(
    state("1 error").getByRole("group", { name: "We couldn't read that site. Type 3 things you sell." }),
  ).toBeVisible();
  await expect(state("1 partial").getByLabel("Cuisine")).toHaveAttribute("data-attention", "true");
  await expect(state("2 loading").getByText("Finding ramen places in Irvine…")).toBeVisible();
  await expect(state("2 success").getByRole("checkbox", { name: /Example/ })).toHaveCount(5);
  await expect(state("2 partial").getByText("Add competitors by name.", { exact: true })).toBeVisible();
  await expect(
    state("2 empty").getByText("No local ramen places found near Irvine. Add competitors by name."),
  ).toBeVisible();
  await expect(state("2 error").getByText("Couldn't load nearby places. Add competitors by name.")).toBeVisible();
  await expect(state("3 success").getByLabel("Short form")).toHaveCount(25);

  // Partial and error states of step 3 come from the user's own actions.
  await state("3 success").getByLabel("Short form").nth(6).fill("");
  await state("3 success").getByRole("button", { name: "Finish setup" }).click();
  await expect(state("3 success").getByText("Couldn't save question 7: it's empty.")).toBeVisible();
  await expect(state("3 success").getByText("Edited")).toHaveCount(1);
  await state("3 error").getByRole("button", { name: "Finish setup" }).click();
  await expect(state("3 error").getByRole("alert")).toHaveText("We couldn't save your business. Try again.");

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
