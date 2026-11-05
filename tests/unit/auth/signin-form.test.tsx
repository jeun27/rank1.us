import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authCopy as c } from "@/lib/auth/copy";

const auth = { signInWithOAuth: vi.fn(), signInWithOtp: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

const { SignInForm } = await import("@/components/auth/SignInForm");

const settings = (google: boolean) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google, email: true } })));

beforeEach(() => {
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
    await userEvent.click(screen.getByRole("button", { name: c.google }));
    expect(await screen.findByRole("button", { name: c.openingGoogle })).toBeDisabled();
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

  it("shows the Google banner when it came back from a failed callback", () => {
    render(<SignInForm next={null} error="google" />);
    expect(screen.getByRole("alert")).toHaveTextContent(c.googleError);
  });

  it("shows the expired-link banner when an email link failed", () => {
    render(<SignInForm next={null} error="link" />);
    expect(screen.getByRole("alert")).toHaveTextContent(c.linkExpired);
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
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "you@ramenhouse.com",
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=%2Fapp%2Fbilling&via=email` },
    });
  });

  it("shows the send error when the link didn't send", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: new Error("smtp") });
    render(<SignInForm next={null} />);
    await userEvent.type(screen.getByLabelText(c.emailLabel), "you@ramenhouse.com");
    await userEvent.click(screen.getByRole("button", { name: c.sendLink }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.sendError);
  });
});
