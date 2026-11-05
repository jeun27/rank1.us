import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engines";
import { ENGINE_IDS } from "@/lib/engines/types";
import { KEYS, NOW, fakeFetch, fixture, hangingFetch, irvine } from "./helpers";

const ok = (engine: (typeof ENGINE_IDS)[number]) =>
  fixture(
    {
      chatgpt: "chatgpt/synthetic-live-advanced.json",
      gemini: "gemini/docs-live-advanced.json",
      google_aio: "google_aio/synthetic-organic-live-advanced.json",
      perplexity: "perplexity/docs-quickstart-web-search.json",
    }[engine],
  );

describe.each(ENGINE_IDS)("%s failures → status 'failed', never thrown", (engine) => {
  const call = (f: typeof fetch, opts: { env?: Record<string, string>; timeoutMs?: number } = {}) =>
    runEngine(engine, irvine("city"), { fetch: f, env: opts.env ?? KEYS, now: NOW, timeoutMs: opts.timeoutMs });

  it.each([400, 401, 404, 429, 500, 502, 503])("HTTP %i", async (status) => {
    const a = await call(fakeFetch({ status_code: status, error: "x" }, status));
    expect(a).toMatchObject({ status: "failed", text: null, citations: [], error: `HTTP ${status}` });
    expect(a.checkedAt).toBe("2026-11-05T12:00:00.000Z");
  });

  it("timeout", async () => {
    const a = await call(hangingFetch(), { timeoutMs: 20 });
    expect(a).toMatchObject({ status: "failed", error: "timeout after 20 ms" });
  });

  it("network error and non-JSON body", async () => {
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await call(boom)).toMatchObject({ status: "failed", error: "network error: fetch failed" });
    expect(await call(fakeFetch("<html>oops</html>"))).toMatchObject({
      status: "failed",
      error: "response is not JSON",
    });
  });

  it("missing keys → failed without a request", async () => {
    const f = fakeFetch(ok(engine));
    const a = await call(f, { env: {} });
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/^missing keys/);
    expect(f).not.toHaveBeenCalled();
  });

  it("the happy fixture is not failed (control)", async () => {
    expect((await call(fakeFetch(ok(engine)))).status).not.toBe("failed");
  });
});

describe.each(["chatgpt", "gemini", "google_aio"] as const)("%s: DataForSEO status_code ≠ 20000 → failed", (engine) => {
  const call = (body: unknown) => runEngine(engine, irvine("city"), { fetch: fakeFetch(body), env: KEYS, now: NOW });

  it("top-level status_code 40100", async () => {
    const a = await call(fixture("dataforseo/synthetic-status-40100.json"));
    expect(a).toMatchObject({
      status: "failed",
      error: "DataForSEO 40100: You are not authorized to access this resource.",
    });
  });

  it("task status_code 40501", async () => {
    const a = await call(fixture("dataforseo/synthetic-task-error-40501.json"));
    expect(a).toMatchObject({ status: "failed", error: "DataForSEO task 40501: Invalid Field.", costUsd: 0 });
  });
});

describe("Perplexity error body or unfinished status → failed", () => {
  const doc = fixture("perplexity/docs-quickstart-web-search.json") as Record<string, unknown>;
  const call = (body: unknown) =>
    runEngine("perplexity", irvine("city"), { fetch: fakeFetch(body), env: KEYS, now: NOW });

  it("status 'failed' or 'incomplete'", async () => {
    for (const status of ["failed", "incomplete", "in_progress"]) {
      expect(await call({ ...doc, status })).toMatchObject({
        status: "failed",
        error: `Perplexity status ${status}`,
        costUsd: 0.03037,
      });
    }
  });

  it("non-null error", async () => {
    expect((await call({ ...doc, error: { message: "bad" } })).status).toBe("failed");
  });
});
