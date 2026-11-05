import { render, screen, waitFor } from "@testing-library/react";
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

  it("idle: labeled email + domain, placeholder, amber final submit, hidden honeypot", () => {
    render(<AuditRequestForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("placeholder");
    expect(screen.getByLabelText("Your domain")).toHaveAttribute("placeholder", "yourbusiness.com");
    const button = screen.getByRole("button", { name: "Get my free audit" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.className).toMatch(/bg-amber/);
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
    expect(JSON.parse(init!.body as string)).toMatchObject({ email: "owner@example.test", domain: "www.ramenhouse.com", website: "" });
    release();
    expect(await screen.findByRole("status")).toHaveTextContent("Got it. We'll email your audit to owner@example.test.");
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

  it("renders no Turnstile widget without NEXT_PUBLIC_TURNSTILE_SITE_KEY", () => {
    render(<AuditRequestForm />);
    expect(document.querySelector("[data-turnstile]")).toBeNull();
  });
});

describe("ContactForm", () => {
  const fillAll = async () => {
    await userEvent.type(screen.getByLabelText("Name"), "Ana Example");
    await userEvent.type(screen.getByLabelText("Email"), "visitor@example.test");
    await userEvent.selectOptions(screen.getByLabelText("Tier"), "Done-for-you (custom)");
    await userEvent.type(screen.getByLabelText("Message"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
  };

  it("has Name, Email, Company, Tier, Message, and exactly the three tiers with no dollar amounts", () => {
    render(<ContactForm />);
    for (const l of ["Name", "Email", "Company", "Tier", "Message"]) expect(screen.getByLabelText(l)).toBeInTheDocument();
    const options = [...(screen.getByLabelText("Tier") as HTMLSelectElement).options].filter((o) => !o.disabled).map((o) => o.textContent);
    expect(options).toEqual(["Agency bundle", "Done-for-you (custom)", "Other"]);
    expect((screen.getByLabelText("Tier") as HTMLSelectElement).options[0]).toHaveTextContent("Choose one");
    expect(screen.getByLabelText("Tier").textContent).not.toMatch(/\$/);
  });

  it("client error: inline errors on empty required fields, no request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    for (const [l, msg] of [
      ["Name", "Add your name"],
      ["Email", "Add a valid email, like you@ramenhouse.com"],
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
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ name: "Ana Example", tier: "Done-for-you (custom)", message: "Hi" });
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
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    render(<ContactForm />);
    await fillAll();
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again in a minute.");
  });
});
