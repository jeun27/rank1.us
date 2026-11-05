import { test, expect } from "@playwright/test";
import { authCopy as c } from "@/lib/auth/copy";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";
import { admin, newUser, openMagicLink, workspacesOwnedBy } from "./helpers/auth";
import { seedBusiness } from "./helpers/team";

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
  expect(path(sent[0].url.searchParams.get("redirect_to")!)).toBe("/auth/callback");
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

test("a callback with no code and no token_hash shows the link banner, not the Google one", async ({ page }) => {
  // What an implicit-flow link looks like to the server: the tokens sit in the #fragment.
  await page.goto("/auth/callback#access_token=x&type=signup");
  expect(path(page.url())).toBe("/signin?error=link");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.linkExpired);
});

test("/signin?error=config shows the unavailable banner, axe clean", async ({ page }) => {
  await page.goto("/signin?error=config");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.configError);
  await expectAxeClean(page);
});

test("an expired email link comes back to /signin with the link banner", async ({ page }) => {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=magiclink");
  expect(path(page.url())).toBe("/signin?error=link");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.linkExpired);
});

test("first self-serve sign-in makes one workspace with the user as owner and lands on onboarding", async ({
  page,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
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
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  await seedBusiness("dfy", "Example DFY Ramen");
  const user = await newUser("team", "team");
  await openMagicLink(page, user.email, "/app/billing");
  expect(new URL(page.url()).pathname).toBe("/team");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("nav")).toBeAttached();
  expect(await workspacesOwnedBy(user.id)).toEqual([]);
});

test("a seeded dfy_client lands on /client", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("dfy", "dfy_client");
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/client");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  expect(await workspacesOwnedBy(user.id)).toEqual([]);
  await expectAxeClean(page);
});

test("Start for $99/mo goes through sign-in to /app/billing, where it opens Checkout (Step 14)", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  await page.goto("/");
  await page.locator("#pricing").getByRole("link", { name: "Start for $99/mo" }).click();
  await page.waitForURL(/\/signin/);
  expect(path(page.url())).toBe("/signin?next=/app/billing");
  const user = await newUser("buyer");
  // The emailed link carries next from the sign-in page, as the form test checks.
  await openMagicLink(page, user.email, "/app/billing");
  expect(new URL(page.url()).pathname).toBe("/app/billing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Billing");
  // Step 14 replaced the disabled stub ("Checkout isn't open yet."): the button now opens Checkout.
  await expect(page.getByRole("button", { name: "Start for $99/mo" })).toBeEnabled();
  await expectNoSideScroll(page);
  await expectAxeClean(page);
});

test("sign out from the Account menu, then /app is closed again", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("signout");
  await openMagicLink(page, user.email);
  await page.getByText(c.account, { exact: true }).click();
  await page.getByRole("button", { name: c.signOut }).click();
  await page.waitForURL(/\/signin$/);
  await page.goto("/app/onboarding");
  expect(path(page.url())).toBe("/signin?next=%2Fapp%2Fonboarding");
});

test("a team user signs out from the workspace sidebar", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  await seedBusiness("dfy", "Example DFY Ramen");
  const user = await newUser("team-out", "team");
  await openMagicLink(page, user.email);
  if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Nav", exact: true }).click();
  await page.locator("nav").getByText(c.account, { exact: true }).click();
  await page.getByRole("button", { name: c.signOut }).click();
  await page.waitForURL(/\/signin$/);
  await page.goto("/team");
  expect(path(page.url())).toBe("/signin?next=%2Fteam");
});

for (const [role, home] of [
  [undefined, "/app/onboarding"],
  ["dfy_client", "/client"],
] as const) {
  test(`a ${role ?? "self-serve"} user who opens /team is sent to ${home}`, async ({ page }) => {
    test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
    const user = await newUser("not-team", role);
    await openMagicLink(page, user.email);
    await page.goto("/team");
    // The role check streams inside Suspense, so the redirect lands just after the shell.
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await expect(page.locator("nav")).toHaveCount(0);
  });
}

test("a signed-in owner gets the /app dashboard placeholder", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("owner");
  await openMagicLink(page, user.email);
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expectAxeClean(page);
});

for (const [role, area, home] of [
  ["team", "/app", "/team"],
  ["team", "/app/billing", "/team"],
  [undefined, "/client", "/app/onboarding"],
  ["dfy_client", "/app", "/client"],
] as const) {
  test(`a ${role ?? "self-serve"} user who opens ${area} is sent to ${home}`, async ({ page }) => {
    test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
    const user = await newUser("wrong-area", role);
    await openMagicLink(page, user.email);
    await page.goto(area);
    await expect(page).toHaveURL(new RegExp(`${home}$`));
  });
}

test("a cross-site sign-out post is refused and the session stays", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("csrf");
  await openMagicLink(page, user.email);
  const res = await page.request.post("/auth/signout", {
    headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(403);
  await page.goto("/app/onboarding");
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
});

test("the email link opened in another browser still lands on next, from the cookie the form set", async ({
  page,
  browser,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  await page.route("**/auth/v1/otp**", (r) => r.fulfill({ json: {} }));
  const user = await newUser("cookie-next");
  await page.goto("/signin?next=/app/billing");
  await page.getByLabel(c.emailLabel).fill(user.email);
  await page.getByRole("button", { name: c.sendLink }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(c.linkSent(user.email));
  const next = (await page.context().cookies()).find((k) => k.name === "rank1_next");
  expect(next).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/auth" });
  expect(decodeURIComponent(next!.value)).toBe("/app/billing"); // Next URL-encodes cookie values

  // Same browser: next comes from the cookie, and the cookie is used up.
  await openMagicLink(page, user.email);
  expect(new URL(page.url()).pathname).toBe("/app/billing");
  expect((await page.context().cookies()).find((k) => k.name === "rank1_next")).toBeUndefined();

  // Another browser has no cookie and no PKCE verifier; the token_hash link still signs in.
  const other = await (await browser.newContext()).newPage();
  await openMagicLink(other, user.email);
  expect(new URL(other.url()).pathname).toBe("/app/onboarding");
  await other.context().close();
});

test("a confirm-signup token_hash link signs a new user in", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const email = `signup-${crypto.randomUUID()}@example.test`;
  const { data, error } = await admin().auth.admin.generateLink({
    type: "signup",
    email,
    password: crypto.randomUUID(),
  });
  if (error) throw error;
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=signup`);
  expect(new URL(page.url()).pathname).toBe("/app/onboarding");
  expect(await workspacesOwnedBy(data.user.id)).toHaveLength(1);
});
