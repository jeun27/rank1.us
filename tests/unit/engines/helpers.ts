import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { EngineRequest } from "@/lib/engines/types";

export const fixture = (path: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "engines", path), "utf8"));

export const KEYS = { DATAFORSEO_LOGIN: "login", DATAFORSEO_PASSWORD: "password", PERPLEXITY_API_KEY: "key" };
export const NOW = () => new Date("2026-11-05T12:00:00Z");

// A fetch that answers every call with `body` and records the request.
export function fakeFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

// A fetch that never answers until aborted.
export const hangingFetch = () =>
  vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
  );

export const sentBody = (f: ReturnType<typeof fakeFetch>) => JSON.parse(String(f.mock.calls[0][1]?.body));

export const irvine = (level: EngineRequest["location"]["level"]): EngineRequest => ({
  question: "best ramen in Irvine",
  location: { level, country: "US", state: "CA", city: "Irvine" },
});
