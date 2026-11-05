import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authCopy as c } from "@/lib/auth/copy";

const auth = { signInWithOAuth: vi.fn(), signInWithOtp: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

let SignInForm: typeof import("@/components/auth/SignInForm").SignInForm;

const settings = (google: boolean) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google, email: true } })));

beforeEach(async () => {
  vi.resetModules();
  ({ SignInForm } = await import("@/components/auth/SignInForm"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  auth.signInWithOAuth.mockReset().mockReturnValue(new Promise(() => {}));
  auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", settings(true));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SignInForm", () => {
  it("opens Google with a callback that carries next, and shows the loading label", async () => {
    render(<SignInForm next="/app/billing" />);
    // Final set: the aurora ring is the one gradient, on the Google sign-in button only (UI.md "Aurora button").
    expect(screen.getByRole("button", { name: c.google })).toHaveClass("aurora-ring");
    await userEvent.click(screen.getByRole("button", { name: c.google }));
    const opening = await screen.findByRole("button", { name: c.openingGoogle });
    expect(opening).toBeDisabled();
    expect(opening).toHaveClass("aurora-ring");
    expect(opening).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=%2Fapp%2Fbilling` },
    });
  });

  it("shows the Google banner instead of a raw error page when Google is off", async () => {
    vi.stubGlobal("fetch", settings(false));
    render(<SignInForm next={null} />);
    await userEvent.click(screen.getByRole("button", { name: c.google }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.googleError);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: c.google })).toBeEnabled();
  });

  it("shows no banner before the click, and checks Google's settings once per page load", async () => {
    vi.stubGlobal("fetch", settings(false));
    render(<SignInForm next={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const google = screen.getByRole("button", { name: c.google });
    await userEvent.click(google);
    await screen.findByRole("alert");
    await userEvent.click(google);
    await screen.findByRole("alert");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("checks again after a failed settings fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(settings(true)));
    render(<SignInForm next={null} />);
    await userEvent.click(screen.getByRole("button", { name: c.google }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: c.google }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("shows the Google banner when it came back from a failed callback", () => {
    render(<SignInForm next={null} error="google" />);
    expect(screen.getByRole("alert")).toHaveTextContent(c.googleError);
  });

  it("shows the unavailable banner when Supabase isn't configured", () => {
    render(<SignInForm next={null} error="config" />);
    expect(screen.getByRole("alert")).toHaveTextContent(c.configError);
  });

  it("shows the expired-link banner when an email link failed", () => {
    render(<SignInForm next={null} error="link" />);
    expect(screen.getByRole("alert")).toHaveTextContent(c.linkExpired);
  });

  it("keeps the magic-link submit a secondary button, not a second aurora ring", () => {
    render(<SignInForm next={null} />);
    expect(screen.getByRole("button", { name: c.sendLink })).not.toHaveClass("aurora-ring");
    expect(document.querySelectorAll(".aurora-ring")).toHaveLength(1);
  });

  it("checks the email before sending", async () => {
    render(<SignInForm next={null} />);
    await userEvent.type(screen.getByLabelText(c.emailLabel), "nope");
    await userEvent.click(screen.getByRole("button", { name: c.sendLink }));
    expect(screen.getByLabelText(c.emailLabel)).toHaveAccessibleDescription(c.emailError);
    expect(screen.getByLabelText(c.emailLabel)).toHaveAttribute("aria-invalid", "true");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("emails a link that comes back through the callback, then says where it went", async () => {
    render(<SignInForm next="/app/billing" />);
    await userEvent.type(screen.getByLabelText(c.emailLabel), "you@ramenhouse.com");
    await userEvent.click(screen.getByRole("button", { name: c.sendLink }));
    expect(await screen.findByRole("status")).toHaveTextContent(c.linkSent("you@ramenhouse.com"));
    // The link must work in any browser, so next rides in a server-set cookie, not the URL.
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "you@ramenhouse.com",
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    expect(fetch).toHaveBeenCalledWith("/auth/next", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ next: "/app/billing" }),
    });
    const order = vi.mocked(fetch).mock.invocationCallOrder[0];
    expect(order).toBeLessThan(auth.signInWithOtp.mock.invocationCallOrder[0]);
  });

  it("shows the send error when the link didn't send", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: new Error("smtp") });
    render(<SignInForm next={null} />);
    await userEvent.type(screen.getByLabelText(c.emailLabel), "you@ramenhouse.com");
    await userEvent.click(screen.getByRole("button", { name: c.sendLink }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.sendError);
  });
});
