import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { adminCopy, missingKeysText } from "@/lib/admin/copy";

const user = vi.fn<() => { email?: string } | null>();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user() }, error: null }) } }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const runEngine = vi.fn();
vi.mock("@/lib/engines", async (orig) => ({
  ...(await orig<object>()),
  runEngine: (...a: unknown[]) => runEngine(...a),
}));

const { default: Page } = await import("@/app/admin/test/page");
const { runEngineTest } = await import("@/app/admin/test/actions");

const KEYS = ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "PERPLEXITY_API_KEY"] as const;
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.stubEnv("FOUNDER_EMAIL", "founder@example.test");
  for (const k of KEYS) vi.stubEnv(k, "");
  user.mockReset();
  runEngine.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("/admin/test gate", () => {
  it("404 when signed out", async () => {
    user.mockReturnValue(null);
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404 for another email", async () => {
    user.mockReturnValue({ email: "owner@example.test" });
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404 for everyone while FOUNDER_EMAIL is unset or blank", async () => {
    user.mockReturnValue({ email: "founder@example.test" });
    for (const v of [undefined, "", "  "]) {
      vi.stubEnv("FOUNDER_EMAIL", v);
      await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("renders the form for the founder (email match ignores case)", async () => {
    user.mockReturnValue({ email: "Founder@Example.test" });
    render(await Page());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(adminCopy.title);
    expect(screen.getByLabelText(adminCopy.engineLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(adminCopy.questionLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(adminCopy.levelLabel)).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      ...Object.values(adminCopy.engines),
      ...Object.values(adminCopy.levels),
    ]);
  });

  it("shows the missing-keys message and disables Run test without keys", async () => {
    user.mockReturnValue({ email: "founder@example.test" });
    render(await Page());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Missing API keys: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, PERPLEXITY_API_KEY. Add them in Vercel to run live tests.",
    );
    expect(screen.getByRole("button", { name: adminCopy.run })).toBeDisabled();
  });

  it("no missing-keys message once keys are set", async () => {
    user.mockReturnValue({ email: "founder@example.test" });
    for (const k of KEYS) vi.stubEnv(k, "set");
    render(await Page());
    expect(screen.queryByText(/Missing API keys/)).toBeNull();
    expect(screen.getByRole("button", { name: adminCopy.run })).toBeEnabled();
  });
});

describe("runEngineTest server action", () => {
  const ok = { engine: "perplexity", question: "best ramen in Irvine", level: "state" };

  it("404s non-founders before any engine call", async () => {
    user.mockReturnValue({ email: "owner@example.test" });
    await expect(runEngineTest(null, form(ok))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(runEngine).not.toHaveBeenCalled();
  });

  it("runs the engine server-side at the chosen level in Irvine, CA and drops raw", async () => {
    user.mockReturnValue({ email: "founder@example.test" });
    runEngine.mockResolvedValue({ status: "ok", text: "t", citations: [], raw: { big: true }, costUsd: 0.01 });
    const res = await runEngineTest(null, form(ok));
    expect(runEngine).toHaveBeenCalledWith("perplexity", {
      question: "best ramen in Irvine",
      location: { level: "state", country: "US", state: "CA", city: "Irvine" },
    });
    expect(res).toEqual({ status: "ok", text: "t", citations: [], costUsd: 0.01 });
  });

  it.each([
    { ...ok, engine: "claude" },
    { ...ok, level: "zip" },
    { ...ok, question: "  " },
    { ...ok, question: "x".repeat(501) },
  ])("rejects bad input %#", async (fields) => {
    user.mockReturnValue({ email: "founder@example.test" });
    expect(await runEngineTest(null, form(fields))).toEqual({ invalid: true });
    expect(runEngine).not.toHaveBeenCalled();
  });
});

describe("admin copy", () => {
  const copyMd = readFileSync("docs/COPY.md", "utf8");
  const section = copyMd.split("## Admin (lead, 2026-11-05)")[1].split("\n# ")[0];
  const strings = Object.values(adminCopy).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v)));

  it.each(strings)("%s is in COPY.md Admin", (s) => {
    expect(section).toContain(`"${s}"`);
  });

  it("fills {names}", () => {
    expect(missingKeysText(["A", "B"])).toBe("Missing API keys: A, B. Add them in Vercel to run live tests.");
  });
});
