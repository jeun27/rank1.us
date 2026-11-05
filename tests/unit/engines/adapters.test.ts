import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engines";
import type { EngineId, EngineRequest } from "@/lib/engines/types";
import { KEYS, NOW, fakeFetch, fixture, irvine, sentBody } from "./helpers";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (engine: EngineId, body: unknown, level: "country" | "state" | "city" = "city", status = 200) => {
  const f = fakeFetch(body, status);
  return { f, answer: runEngine(engine, irvine(level), { fetch: f, env: KEYS, now: NOW }) };
};

describe("ChatGPT (DataForSEO LLM Scraper)", () => {
  const doc = fixture("chatgpt/synthetic-live-advanced.json") as Json;
  const result = doc.tasks[0].result[0];

  it("parses the docs example into an EngineAnswer", async () => {
    const { f, answer } = run("chatgpt", doc);
    const a = await answer;
    expect(a).toMatchObject({
      status: "ok",
      text: result.markdown,
      costUsd: 0.004,
      checkedAt: "2026-11-05T12:00:00.000Z",
    });
    expect(a.raw).toEqual(doc);
    expect(a.error).toBeUndefined();
    expect(f.mock.calls[0][0]).toBe("https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced");
    expect(f.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Basic ${btoa("login:password")}` });
  });

  it("citations are exactly result.sources, in order", async () => {
    const a = await run("chatgpt", doc).answer;
    expect(a.citations).toHaveLength(3);
    expect(a.citations).toEqual(
      result.sources.map((s: Json, i: number) => ({ url: s.url, domain: s.domain, title: s.title, position: i + 1 })),
    );
  });

  it("always runs at country level: city request → country code 2840 and fallback_country", async () => {
    for (const level of ["city", "state"] as const) {
      const { f, answer } = run("chatgpt", doc, level);
      expect(await answer).toMatchObject({ locationUsed: "US", locationSupported: "fallback_country" });
      expect(sentBody(f)).toEqual([
        { keyword: "best ramen in Irvine", location_code: 2840, language_code: "en", force_web_search: true },
      ]);
    }
    expect(await run("chatgpt", doc, "country").answer).toMatchObject({ locationSupported: "exact" });
  });
});

describe("Gemini (DataForSEO LLM Scraper)", () => {
  const doc = fixture("gemini/docs-live-advanced.json") as Json;
  const result = doc.tasks[0].result[0];

  it("parses the docs example, citations = result.sources in order", async () => {
    const { f, answer } = run("gemini", doc);
    const a = await answer;
    expect(a).toMatchObject({ status: "ok", text: result.markdown, costUsd: 0.004 });
    expect(a.citations.map((c) => c.url)).toEqual(result.sources.map((s: Json) => s.url));
    expect(a.citations).toHaveLength(2);
    expect(f.mock.calls[0][0]).toBe("https://api.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced");
  });

  it("falls back to country for state and city", async () => {
    const { f, answer } = run("gemini", doc, "city");
    expect(await answer).toMatchObject({ locationUsed: "US", locationSupported: "fallback_country" });
    expect(sentBody(f)).toEqual([{ keyword: "best ramen in Irvine", location_code: 2840, language_code: "en" }]);
  });
});

describe("Google AI Overview (DataForSEO organic SERP)", () => {
  const doc = fixture("google_aio/synthetic-organic-live-advanced.json") as Json;
  const aio = doc.tasks[0].result[0].items.find((i: Json) => i.type === "ai_overview");

  it("parses the ai_overview item; citations = its references, in order", async () => {
    const a = await run("google_aio", doc).answer;
    expect(a).toMatchObject({ status: "ok", text: aio.markdown, costUsd: 0.003, locationSupported: "exact" });
    expect(a.citations).toEqual(
      aio.references.map((r: Json, i: number) => ({ url: r.url, domain: r.domain, title: r.title, position: i + 1 })),
    );
    expect(a.citations).toHaveLength(2);
  });

  it("sends location_name at city and state level, location_code at country or when given", async () => {
    const city = run("google_aio", doc, "city");
    expect(await city.answer).toMatchObject({ locationUsed: "Irvine,California,United States" });
    expect(sentBody(city.f)).toEqual([
      {
        keyword: "best ramen in Irvine",
        location_name: "Irvine,California,United States",
        language_code: "en",
        load_async_ai_overview: true,
      },
    ]);
    const state = run("google_aio", doc, "state");
    expect(sentBody((await state.answer, state.f))[0].location_name).toBe("California,United States");
    const country = run("google_aio", doc, "country");
    expect(sentBody((await country.answer, country.f))[0].location_code).toBe(2840);
    const f = fakeFetch(doc);
    await runEngine(
      "google_aio",
      {
        question: "q",
        location: { level: "city", country: "US", state: "CA", city: "Irvine", dfsLocationCode: 1013962 },
      },
      { fetch: f, env: KEYS, now: NOW },
    );
    expect(sentBody(f)[0]).toMatchObject({ location_code: 1013962 });
    expect(sentBody(f)[0].location_name).toBeUndefined();
  });

  it("no ai_overview item → no_overview with no citations", async () => {
    const a = await run("google_aio", fixture("google_aio/synthetic-no-overview.json")).answer;
    expect(a).toMatchObject({ status: "no_overview", text: null, citations: [], costUsd: 0.002 });
    expect(a.error).toBeUndefined();
  });
});

describe("Perplexity (Agent API)", () => {
  const doc = fixture("perplexity/docs-quickstart-web-search.json") as Json;
  const results = doc.output.filter((o: Json) => o.type === "search_results").flatMap((o: Json) => o.results);
  const text = doc.output
    .find((o: Json) => o.type === "message")
    .content.find((c: Json) => c.type === "output_text").text;

  it("parses the docs web_search example; citations = search_results in order", async () => {
    const { f, answer } = run("perplexity", doc);
    const a = await answer;
    expect(a).toMatchObject({ status: "ok", text, costUsd: 0.03037, locationSupported: "exact" });
    expect(a.citations).toHaveLength(10);
    expect(a.citations).toEqual(
      results.map((r: Json, i: number) => ({
        url: r.url,
        domain: new URL(r.url).hostname,
        title: r.title,
        position: i + 1,
      })),
    );
    expect(f.mock.calls[0][0]).toBe("https://api.perplexity.ai/v1/agent");
    expect(f.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer key" });
  });

  it("sends web_search with user_location per level and the default sonar model", async () => {
    const city = run("perplexity", doc, "city");
    expect(await city.answer).toMatchObject({ locationUsed: "Irvine, California, United States" });
    expect(sentBody(city.f)).toEqual({
      model: "perplexity/sonar",
      input: "best ramen in Irvine",
      tools: [{ type: "web_search", user_location: { country: "US", region: "California", city: "Irvine" } }],
    });
    const state = run("perplexity", doc, "state");
    expect(sentBody((await state.answer, state.f)).tools[0].user_location).toEqual({
      country: "US",
      region: "California",
    });
    const country = run("perplexity", doc, "country");
    expect(sentBody((await country.answer, country.f)).tools[0].user_location).toEqual({ country: "US" });
  });

  it("reports exact only when the requested level was sent in user_location", async () => {
    const send = async (location: EngineRequest["location"]) => {
      const f = fakeFetch(doc);
      const a = await runEngine("perplexity", { question: "q", location }, { fetch: f, env: KEYS, now: NOW });
      return { a, sent: sentBody(f).tools[0].user_location };
    };
    const noState = await send({ level: "city", country: "US", city: "Irvine" });
    expect(noState.sent).toEqual({ country: "US" });
    expect(noState.a).toMatchObject({ locationSupported: "fallback_country", locationUsed: "United States" });
    const stateOnly = await send({ level: "state", country: "US" });
    expect(stateOnly.sent).toEqual({ country: "US" });
    expect(stateOnly.a.locationSupported).toBe("fallback_country");
    const noCity = await send({ level: "city", country: "US", state: "CA" });
    expect(noCity.sent).toEqual({ country: "US", region: "California" });
    expect(noCity.a.locationSupported).toBe("fallback_country");
    for (const level of ["country", "state", "city"] as const) {
      expect((await send(irvine(level).location)).a.locationSupported, level).toBe("exact");
    }
  });

  it("PERPLEXITY_MODEL overrides the model", async () => {
    const f = fakeFetch(doc);
    await runEngine("perplexity", irvine("city"), {
      fetch: f,
      env: { ...KEYS, PERPLEXITY_MODEL: "perplexity/other" },
      now: NOW,
    });
    expect(sentBody(f).model).toBe("perplexity/other");
  });

  it("keeps every returned link across search_results items, repeats included", async () => {
    const a = await run("perplexity", fixture("perplexity/synthetic-restaurant-web-search.json")).answer;
    expect(a.citations.map((c) => [c.position, c.url])).toEqual([
      [1, "https://example-reviews.test/irvine/ramen"],
      [2, "https://example-blog.test/ramen-guide"],
      [3, "https://example-reviews.test/irvine/ramen"],
    ]);
  });

  it("parses the docs response shape (no status field) and the no-tools example (no citations)", async () => {
    const shape = await run("perplexity", fixture("perplexity/docs-web-search-response-shape.json")).answer;
    expect(shape).toMatchObject({ status: "ok", text: "The answer generated from the search results.", costUsd: null });
    expect(shape.citations.map((c) => c.url)).toEqual(["https://example.com/news"]);
    const basic = await run("perplexity", fixture("perplexity/docs-quickstart-basic.json")).answer;
    expect(basic).toMatchObject({ status: "ok", citations: [], costUsd: 0.00452 });
  });
});

describe("state codes and API URL overrides", () => {
  const pdoc = fixture("perplexity/docs-quickstart-web-search.json");

  it("an unknown state code is not sent: Perplexity falls back, AIO fails", async () => {
    const location = { level: "city" as const, country: "US", state: "Calif", city: "Irvine" };
    const f = fakeFetch(pdoc);
    const a = await runEngine("perplexity", { question: "q", location }, { fetch: f, env: KEYS, now: NOW });
    expect(sentBody(f).tools[0].user_location).toEqual({ country: "US" });
    expect(a.locationSupported).toBe("fallback_country");
    const aio = await runEngine(
      "google_aio",
      { question: "q", location },
      { fetch: fakeFetch({}), env: KEYS, now: NOW },
    );
    expect(aio.status).toBe("failed");
  });

  it("DATAFORSEO_API_URL and PERPLEXITY_API_URL replace the base URLs", async () => {
    const env = {
      ...KEYS,
      DATAFORSEO_API_URL: "http://127.0.0.1:4599/v3",
      PERPLEXITY_API_URL: "http://127.0.0.1:4599/pplx",
    };
    const d = fakeFetch(fixture("gemini/docs-live-advanced.json"));
    await runEngine("gemini", irvine("country"), { fetch: d, env, now: NOW });
    expect(d.mock.calls[0][0]).toBe("http://127.0.0.1:4599/v3/ai_optimization/gemini/llm_scraper/live/advanced");
    const p = fakeFetch(pdoc);
    await runEngine("perplexity", irvine("country"), { fetch: p, env, now: NOW });
    expect(p.mock.calls[0][0]).toBe("http://127.0.0.1:4599/pplx");
  });
});
