import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { admin, newUser, openMagicLink } from "./helpers/auth";
import { seedBusiness } from "./helpers/team";

// Step 12: a team user manages a DFY client's users; the client lands on /client from an invite link and
// sees the fix list only when the team shows it. Needs the local stack to seed and mint links.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};
const show = async (page: Page, pane: "Nav" | "Context" | "Document") => {
  if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: pane, exact: true }).click();
};

test("invite link → /client; fixes only when shown; Remove access → Nothing tracked yet.", async ({
  page,
  browser,
}) => {
  const tag = randomUUID().slice(0, 8);
  const name = `Example DFY Ramen ${tag}`;
  const dfy = await seedBusiness("dfy", name);
  must(
    await admin()
      .from("fixes")
      .insert({ business_id: dfy, rule_key: "R14", size: "S", title: "robots.txt allows AI search crawlers" })
      .select("id")
      .single(),
  );
  // What inviteClient does, without sending mail: the admin invite link, then the grant.
  const email = `client-${tag}@example.test`;
  const { data: link, error } = await admin().auth.admin.generateLink({ type: "invite", email });
  if (error) throw error;
  must(await admin().rpc("grant_dfy_client", { p_user_id: link.user.id, p_business_id: dfy }));

  // The client opens the emailed link and lands on /client: the business, no fix list yet.
  const client = await (await browser.newContext({ viewport: page.viewportSize()! })).newPage();
  await client.goto(`/auth/callback?token_hash=${link.properties.hashed_token}&type=invite`);
  await expect(client).toHaveURL(/\/client$/);
  await expect(client.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(client.getByText(name)).toBeVisible();
  await expect(client.getByRole("heading", { name: "What to fix next" })).toHaveCount(0);

  // The team opens the Clients tab: the user is listed; an existing account is refused.
  await openMagicLink(page, (await newUser("team-clients", "team")).email);
  await page.goto(`/team?b=${dfy}`);
  await show(page, "Context");
  await page.getByRole("button", { name: "Clients", exact: true }).click();
  await show(page, "Document");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("list", { name: "Clients" }).getByText(email)).toBeVisible();
  const taken = await newUser("self-serve");
  await panel.getByLabel("Email").fill(taken.email);
  await panel.getByRole("button", { name: "Send invite" }).click();
  await expect(panel.getByRole("status")).toHaveText("This email already has a Rank1 account.");
  await panel.getByLabel("Email").fill(email);
  await panel.getByRole("button", { name: "Send invite" }).click();
  await expect(panel.getByRole("status")).toHaveText("Already invited.");

  // Show fix list → the client sees it, read-only.
  const box = panel.getByRole("checkbox", { name: "Show fix list to client" });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect
    .poll(
      async () =>
        must(await admin().from("businesses").select("fix_list_visible").eq("id", dfy).single()).fix_list_visible,
    )
    .toBe(true);
  await client.reload();
  await expect(client.getByRole("heading", { name: "What to fix next" })).toBeVisible();
  await expect(client.getByText("robots.txt allows AI search crawlers")).toBeVisible();
  await expect(client.getByLabel("Status")).toHaveCount(0);

  // Remove access → the client keeps the role but sees the empty state.
  await panel.getByRole("list", { name: "Clients" }).getByRole("button", { name: "Remove access" }).click();
  await expect(panel.getByRole("list", { name: "Clients" }).getByText(email)).toHaveCount(0);
  await client.reload();
  await expect(client).toHaveURL(/\/client$/);
  await expect(client.getByText("Nothing tracked yet.", { exact: true })).toBeVisible();
  await expect(client.getByText(name)).toHaveCount(0);
});
