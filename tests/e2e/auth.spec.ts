import { test, expect } from "@playwright/test";
import { authCopy as c } from "@/lib/auth/copy";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";
import { newUser, openMagicLink, workspacesOwnedBy } from "./helpers/auth";

const path = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

for (const area of ["/app", "/app/billing", "/team", "/client"]) {
  test(`signed out, ${area} goes to /signin with next`, async ({ page }) => {
    await page.goto(area);
    expect(path(page.url())).toBe(`/signin?next=${encodeURIComponent(area)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.title);
  });
}

test("the sign-in page: one H1, Google first and full width on phones, axe clean", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const google = page.getByRole("button", { name: c.google });
  await expect(google).toBeVisible();
  await expect(page.getByLabel(c.emailLabel)).toBeVisible();
  if (page.viewportSize()!.width < 768) {
    const box = (await google.boundingBox())!;
    expect(box.width).toBeGreaterThan(page.viewportSize()!.width - 100);
  }
  await expectNoSideScroll(page);
  await expectAxeClean(page);
});

test("Google is off on the local stack, so the click shows the banner, not a raw error page", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: c.google }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.googleError);
  expect(new URL(page.url()).pathname).toBe("/signin");
  await expectAxeClean(page);
});

test("Google (stubbed): opens authorize with the callback and next, and a failed return shows the banner", async ({
  page,
}) => {
  await page.route("**/auth/v1/settings", (r) => r.fulfill({ json: { external: { google: true, email: true } } }));
  let authorize: URL | undefined;
  await page.route("**/auth/v1/authorize**", (r) => {
    authorize = new URL(r.request().url());
    const back = new URL(authorize.searchParams.get("redirect_to")!);
    back.searchParams.set("error", "access_denied");
    return r.fulfill({ status: 302, headers: { location: back.toString() } });
  });
  await page.goto("/signin?next=/app/billing");
  await page.getByRole("button", { name: c.google }).click();
  await page.waitForURL(/\/signin\?error=google/);
  expect(authorize!.searchParams.get("provider")).toBe("google");
  expect(path(authorize!.searchParams.get("redirect_to")!)).toBe("/auth/callback?next=%2Fapp%2Fbilling");
  expect(path(page.url())).toBe("/signin?error=google&next=%2Fapp%2Fbilling");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.googleError);
});

test("magic-link form: sends with a callback that carries next, then says where it went", async ({ page }) => {
  const sent: { url: URL; body: Record<string, unknown> }[] = [];
  await page.route("**/auth/v1/otp**", (r) => {
    sent.push({ url: new URL(r.request().url()), body: r.request().postDataJSON() });
    return r.fulfill({ json: {} });
  });
  await page.goto("/signin?next=/app/billing");
  await page.getByLabel(c.emailLabel).fill("you@ramenhouse.com");
  await page.getByRole("button", { name: c.sendLink }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(c.linkSent("you@ramenhouse.com"));
  expect(sent).toHaveLength(1);
  expect(sent[0].body.email).toBe("you@ramenhouse.com");
  expect(path(sent[0].url.searchParams.get("redirect_to")!)).toBe("/auth/callback?next=%2Fapp%2Fbilling&via=email");
  await expectAxeClean(page);
});

test("magic-link form: a failed send shows the error, a bad email shows the field error", async ({ page }) => {
  await page.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 500, json: { msg: "smtp" } }));
  await page.goto("/signin");
  await page.getByRole("button", { name: c.sendLink }).click();
  await expect(page.getByText(c.emailError)).toBeVisible();
  await page.getByLabel(c.emailLabel).fill("you@ramenhouse.com");
  await page.getByRole("button", { name: c.sendLink }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.sendError);
});

test("an expired email link comes back to /signin with the link banner", async ({ page }) => {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=magiclink");
  expect(path(page.url())).toBe("/signin?error=link");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.linkExpired);
});

test("first self-serve sign-in makes one workspace with the user as owner and lands on onboarding", async ({
  page,
}) => {
  const user = await newUser("selfserve");
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add your business");
  expect(await workspacesOwnedBy(user.id)).toEqual([{ workspace_id: expect.any(String), role: "owner" }]);
  await expectAxeClean(page);

  // A second sign-in reuses it.
  await page.context().clearCookies();
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
  expect(await workspacesOwnedBy(user.id)).toHaveLength(1);
});

test("a seeded team user lands on /team with no self-serve workspace", async ({ page }) => {
  const user = await newUser("team", "team");
  await openMagicLink(page, user.email, "/app/billing");
  expect(new URL(page.url()).pathname).toBe("/team");
  expect(await workspacesOwnedBy(user.id)).toEqual([]);
});

test("a seeded dfy_client lands on /client", async ({ page }) => {
  const user = await newUser("dfy", "dfy_client");
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/client");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  expect(await workspacesOwnedBy(user.id)).toEqual([]);
  await expectAxeClean(page);
});

test("Start for $99/mo goes through sign-in to the billing paywall stub", async ({ page }) => {
  await page.goto("/");
  await page.locator("#pricing").getByRole("link", { name: "Start for $99/mo" }).click();
  await page.waitForURL(/\/signin/);
  expect(path(page.url())).toBe("/signin?next=/app/billing");
  const user = await newUser("buyer");
  // The emailed link carries next from the sign-in page, as the form test checks.
  await openMagicLink(page, user.email, "/app/billing");
  expect(new URL(page.url()).pathname).toBe("/app/billing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Billing");
  await expect(page.getByRole("button", { name: "Start for $99/mo" })).toBeDisabled();
  await expect(page.getByText(c.checkoutClosed)).toBeVisible();
  await expectNoSideScroll(page);
  await expectAxeClean(page);
});

test("sign out from the Account menu, then /app is closed again", async ({ page }) => {
  const user = await newUser("signout");
  await openMagicLink(page, user.email);
  await page.getByText(c.account, { exact: true }).click();
  await page.getByRole("button", { name: c.signOut }).click();
  await page.waitForURL(/\/signin$/);
  await page.goto("/app/onboarding");
  expect(path(page.url())).toBe("/signin?next=%2Fapp%2Fonboarding");
});
