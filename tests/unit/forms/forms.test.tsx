import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditRequestForm } from "@/components/forms/AuditRequestForm";
import { ContactForm } from "@/components/contact/ContactForm";

afterEach(() => vi.unstubAllGlobals());

// Resolves when `release` is called, so the submitting state can be checked.
function pendingFetch(status: number, body: unknown = {}) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
    await gate;
    return Response.json(body, { status });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, release };
}

describe("AuditRequestForm", () => {
  const fill = async (email: string, domain: string) => {
    if (email) await userEvent.type(screen.getByLabelText("Email"), email);
    if (domain) await userEvent.type(screen.getByLabelText("Your domain"), domain);
    await userEvent.click(screen.getByRole("button", { name: "Get my free audit" }));
  };

  it("idle: labeled email + domain, placeholder, accent final submit, hidden honeypot", () => {
    render(<AuditRequestForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("placeholder");
    expect(screen.getByLabelText("Your domain")).toHaveAttribute("placeholder", "yourbusiness.com");
    const button = screen.getByRole("button", { name: "Get my free audit" });
    expect(button).toHaveAttribute("type", "submit");
    // v3 (D34): the final CTA uses the accent; amber is no longer a button colour.
    expect(button.className).toMatch(/bg-accent/);
    expect(button.className).not.toMatch(/bg-jellyDeep/);
    const trap = document.querySelector('input[name="website"]')!;
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("client error: inline field errors, focus on the first, no request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<AuditRequestForm />);
    await fill("", "ramenhouse");
    expect(screen.getByText("Add the ending, like ramenhouse.com")).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Add a valid email, like you@ramenhouse.com");
    expect(screen.getByLabelText("Your domain")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Your domain")).toHaveAccessibleDescription("Add the ending, like ramenhouse.com");
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submitting shows 'Checking…', then success with the email", async () => {
    const { fetch, release } = pendingFetch(202, { status: "queued" });
    render(<AuditRequestForm />);
    await fill("owner@example.test", "www.ramenhouse.com");
    const busy = screen.getByRole("button", { name: "Checking…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/audit/request");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      email: "owner@example.test",
      domain: "www.ramenhouse.com",
      website: "",
    });
    release();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Got it. We'll email your audit to owner@example.test.",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    [429, "Free audits are full for today. Try again tomorrow."],
    [500, "That didn't send. Try again in a minute."],
    [403, "That didn't send. Try again in a minute."],
  ])("server %i: Banner error, form stays", async (status, text) => {
    const { release } = pendingFetch(status);
    release();
    render(<AuditRequestForm />);
    await fill("owner@example.test", "ramenhouse.com");
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Get my free audit" })).toBeEnabled();
  });

  it("server 400 maps field names to inline errors", async () => {
    const { release } = pendingFetch(400, { errors: ["domain"] });
    release();
    render(<AuditRequestForm />);
    await fill("owner@example.test", "ramenhouse.com");
    expect(await screen.findByText("Add the ending, like ramenhouse.com")).toBeVisible();
  });

  // Founder-approved (07:56 UTC): the widget appears once both fields are valid; the button waits for a token.
  describe("with Turnstile", () => {
    type Opts = { sitekey: string; callback?: (t: string) => void; "expired-callback"?: () => void };
    const widget = () => {
      const w = { opts: null as Opts | null, reset: vi.fn(), remove: vi.fn() };
      vi.stubGlobal("turnstile", {
        render: (_el: HTMLElement, o: Opts) => ((w.opts = o), "w1"),
        reset: w.reset,
        remove: w.remove,
      });
      return w;
    };
    afterEach(() => vi.unstubAllEnvs());
    const button = () => screen.getByRole("button", { name: "Get my free audit" });
    const region = () => document.querySelector("[data-turnstile-reveal]")!;

    it("empty → partial → valid → token → submit; inactive clicks send nothing", async () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      const w = widget();
      const { fetch, release } = pendingFetch(202, { status: "queued" });
      render(<AuditRequestForm />);
      expect(button()).toHaveAttribute("aria-disabled", "true");
      expect(button()).toHaveAccessibleDescription("Enter your email and website to continue");
      expect(region()).toHaveAttribute("data-revealed", "false");
      expect(region()).toHaveAttribute("inert");
      await userEvent.type(screen.getByLabelText("Email"), "owner@example.test");
      expect(region()).toHaveAttribute("data-revealed", "false");
      await userEvent.type(screen.getByLabelText("Your domain"), "ramenhouse.com");
      expect(region()).toHaveAttribute("data-revealed", "true");
      expect(region()).not.toHaveAttribute("inert");
      expect(button()).toHaveAccessibleDescription("Check the box to continue");
      await userEvent.click(button());
      expect(fetch).not.toHaveBeenCalled();
      await waitFor(() => expect(w.opts?.sitekey).toBe("1x00000000000000000000AA"));
      act(() => w.opts!.callback!("token-1"));
      expect(button()).not.toHaveAttribute("aria-disabled");
      expect(button()).not.toHaveAccessibleDescription();
      await userEvent.click(button());
      expect(fetch).toHaveBeenCalledTimes(1);
      release();
      expect(await screen.findByRole("status")).toBeInTheDocument();
    });

    it("editing a field back to invalid: inactive again, the token kept (no reset); valid again: active", async () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      const w = widget();
      render(<AuditRequestForm />);
      await userEvent.type(screen.getByLabelText("Email"), "owner@example.test");
      await userEvent.type(screen.getByLabelText("Your domain"), "ramenhouse.com");
      await waitFor(() => expect(w.opts).not.toBeNull());
      act(() => w.opts!.callback!("token-1"));
      await userEvent.clear(screen.getByLabelText("Your domain"));
      await userEvent.type(screen.getByLabelText("Your domain"), "ramenhouse");
      expect(button()).toHaveAttribute("aria-disabled", "true");
      expect(button()).toHaveAccessibleDescription("Enter your email and website to continue");
      expect(region()).toHaveAttribute("data-revealed", "true");
      await userEvent.type(screen.getByLabelText("Your domain"), ".com");
      expect(button()).not.toHaveAttribute("aria-disabled");
      expect(w.reset).not.toHaveBeenCalled();
    });

    it("an inactive click with an invalid field shows the field errors, like before", async () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      widget();
      render(<AuditRequestForm />);
      await userEvent.type(screen.getByLabelText("Your domain"), "ramenhouse");
      await userEvent.click(button());
      expect(screen.getByText("Add the ending, like ramenhouse.com")).toBeInTheDocument();
    });

    // #129 S1: autofill can set both fields without input events. The form re-reads the real values on
    // focus, blur, animationstart (autofill) and submit; valid on submit with no token reveals the widget.
    const autofill = () => {
      (screen.getByLabelText("Email") as HTMLInputElement).value = "owner@example.test";
      (screen.getByLabelText("Your domain") as HTMLInputElement).value = "ramenhouse.com";
    };

    it("autofill with no events, then submit: reveals Turnstile and says 'Check the box to continue'", async () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      widget();
      const { fetch } = pendingFetch(202, { status: "queued" });
      render(<AuditRequestForm />);
      autofill();
      expect(region()).toHaveAttribute("data-revealed", "false");
      fireEvent.submit(button().closest("form")!);
      expect(region()).toHaveAttribute("data-revealed", "true");
      expect(button()).toHaveAccessibleDescription("Check the box to continue");
      expect(screen.queryByText("Add the ending, like ramenhouse.com")).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each(["focus", "blur", "animationStart"] as const)(
      "autofill with no input events, then %s: the form re-reads the values and reveals",
      async (event) => {
        vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
        widget();
        render(<AuditRequestForm />);
        autofill();
        fireEvent[event](screen.getByLabelText("Email"));
        expect(region()).toHaveAttribute("data-revealed", "true");
        expect(button()).toHaveAccessibleDescription("Check the box to continue");
      },
    );

    it("globals.css flags autofilled inputs with a no-op animation, so animationstart fires", () => {
      const css = readFileSync("src/app/globals.css", "utf8");
      expect(css).toMatch(/input:-webkit-autofill\s*\{\s*animation:\s*autofill-start 1ms;/);
      expect(css).toContain("@keyframes autofill-start");
    });

    it("an expired token: inactive again and the widget is reset", async () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      const w = widget();
      render(<AuditRequestForm />);
      await userEvent.type(screen.getByLabelText("Email"), "owner@example.test");
      await userEvent.type(screen.getByLabelText("Your domain"), "ramenhouse.com");
      await waitFor(() => expect(w.opts).not.toBeNull());
      act(() => w.opts!.callback!("token-1"));
      act(() => w.opts!["expired-callback"]!());
      expect(button()).toHaveAttribute("aria-disabled", "true");
      expect(button()).toHaveAccessibleDescription("Check the box to continue");
      expect(w.reset).toHaveBeenCalledWith("w1");
    });
  });

  it("renders no Turnstile widget without NEXT_PUBLIC_TURNSTILE_SITE_KEY", () => {
    render(<AuditRequestForm />);
    expect(document.querySelector("[data-turnstile]")).toBeNull();
  });
});

describe("ContactForm", () => {
  const fillAll = async () => {
    await userEvent.type(screen.getByLabelText("Name"), "Ana Example");
    await userEvent.type(screen.getByLabelText("Email"), "visitor@example.test");
    await userEvent.selectOptions(screen.getByLabelText("Industry"), "Restaurant");
    await userEvent.selectOptions(screen.getByLabelText("Tier"), "Done-for-you (custom)");
    await userEvent.type(screen.getByLabelText("Message"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
  };

  it("has Name, Email, Company, Tier, Message, and exactly the three tiers with no dollar amounts", () => {
    render(<ContactForm />);
    for (const l of ["Name", "Email", "Company", "Tier", "Message"])
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    const options = [...(screen.getByLabelText("Tier") as HTMLSelectElement).options]
      .filter((o) => !o.disabled)
      .map((o) => o.textContent);
    expect(options).toEqual(["Agency bundle", "Done-for-you (custom)", "Other"]);
    expect((screen.getByLabelText("Tier") as HTMLSelectElement).options[0]).toHaveTextContent("Choose one");
    expect(screen.getByLabelText("Tier").textContent).not.toMatch(/\$/);
  });

  it("Industry (Jeun #22): required select with the six options; Other shows the optional text input", async () => {
    render(<ContactForm />);
    const select = screen.getByLabelText("Industry") as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(select.options[0]).toHaveTextContent("Pick your industry.");
    expect([...select.options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual([
      "Restaurant",
      "HVAC",
      "Plumbing",
      "Roofing",
      "Pest control",
      "Other",
    ]);
    expect(screen.queryByLabelText("Your industry (optional)")).toBeNull();
    await userEvent.selectOptions(select, "Other");
    const other = screen.getByLabelText("Your industry (optional)");
    expect(other).toHaveAttribute("maxlength", "60");
    expect(other).not.toBeRequired();
    await userEvent.selectOptions(select, "HVAC");
    expect(screen.queryByLabelText("Your industry (optional)")).toBeNull();
  });

  it("posts industry and the Other text", async () => {
    const { fetch, release } = pendingFetch(200, { ok: true });
    release();
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText("Name"), "Ana Example");
    await userEvent.type(screen.getByLabelText("Email"), "visitor@example.test");
    await userEvent.selectOptions(screen.getByLabelText("Industry"), "Other");
    await userEvent.type(screen.getByLabelText("Your industry (optional)"), "Pool service");
    await userEvent.selectOptions(screen.getByLabelText("Tier"), "Other");
    await userEvent.type(screen.getByLabelText("Message"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("status");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      industry: "Other",
      industry_other: "Pool service",
    });
  });

  it("client error: inline errors on empty required fields, no request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    for (const [l, msg] of [
      ["Name", "Add your name"],
      ["Email", "Add a valid email, like you@ramenhouse.com"],
      ["Industry", "Pick your industry."],
      ["Tier", "Choose one"],
      ["Message", "Add a message"],
    ]) {
      expect(screen.getByLabelText(l)).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText(l)).toHaveAccessibleDescription(msg);
    }
    expect(screen.getByLabelText("Company")).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("'Sending…' then the success message", async () => {
    const { fetch, release } = pendingFetch(200, { ok: true });
    render(<ContactForm />);
    await fillAll();
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(fetch.mock.calls[0][0]).toBe("/api/contact");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      name: "Ana Example",
      tier: "Done-for-you (custom)",
      message: "Hi",
    });
    release();
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. We'll reply by email within 2 business days.");
  });

  it.each([
    [429, "Too many tries. Try again in an hour."],
    [502, "That didn't send. Try again in a minute."],
    [500, "That didn't send. Try again in a minute."],
  ])("server %i shows its error", async (status, text) => {
    const { release } = pendingFetch(status);
    release();
    render(<ContactForm />);
    await fillAll();
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("a network failure shows the send error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    render(<ContactForm />);
    await fillAll();
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again in a minute.");
  });
});
