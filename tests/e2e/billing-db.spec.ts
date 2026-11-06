import { test, expect } from "@playwright/test";
import { admin, newUser, openMagicLink, workspacesOwnedBy } from "./helpers/auth";

// Step 14 on the local stack: the real /app/billing and header switcher, read through RLS.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

test("unpaid owner: 'Start for $99/mo'; no switcher with one business", async ({ page }) => {
  const owner = await newUser("bill-unpaid");
  await openMagicLink(page, owner.email);
  const [{ workspace_id }] = await workspacesOwnedBy(owner.id);
  must(await admin().from("businesses").insert({ workspace_id, name: "Example Ramen House" }).select("id"));
  await page.goto("/app/billing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Billing");
  await expect(page.getByRole("button", { name: "Start for $99/mo" })).toBeEnabled();
  // X9a: one business is a plain name, so phones show the page crumb only.
  const name = page.getByRole("banner").getByText("Example Ramen House");
  if (page.viewportSize()!.width < 768) await expect(name).toBeHidden();
  else await expect(name).toBeVisible();
  await expect(page.getByRole("button", { name: "Example Ramen House ▾" })).toHaveCount(0);
});

test("paid owner with two businesses: plan math, and the switcher changes the current business", async ({ page }) => {
  const owner = await newUser("bill-paid");
  await openMagicLink(page, owner.email);
  const [{ workspace_id }] = await workspacesOwnedBy(owner.id);
  must(
    await admin()
      .from("workspaces")
      .update({ subscription_status: "active", seats_quantity: 2 })
      .eq("id", workspace_id)
      .select("id"),
  );
  must(await admin().from("businesses").insert({ workspace_id, name: "Example Ramen House" }).select("id"));
  must(await admin().from("businesses").insert({ workspace_id, name: "Example Taco Stand" }).select("id"));

  await page.goto("/app/billing");
  await expect(page.getByText("2 businesses x $99 = $198/mo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();

  await page.goto("/app");
  await page.getByRole("button", { name: "Example Ramen House ▾" }).click();
  await page
    .getByRole("list", { name: "Business switcher" })
    .getByRole("button", { name: /^Example Taco Stand/ })
    .click();
  await expect(page.getByRole("button", { name: "Example Taco Stand ▾" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Example Taco Stand ▾" })).toBeVisible();
});
