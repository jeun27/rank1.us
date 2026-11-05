import { describe, expect, it } from "vitest";
import { mapsSearch } from "@/lib/engines/maps";
import { findLocalCompetitors } from "@/lib/onboarding";
import { KEYS, NOW, fakeFetch, fixture, sentBody } from "../engines/helpers";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const docs = fixture("maps/synthetic-maps-live-advanced.json") as Json;
const irvine = fixture("maps/synthetic-irvine-ramen.json");
const deps = (f: ReturnType<typeof fakeFetch>, env: Record<string, string> = KEYS) => ({ fetch: f, env, now: NOW });

describe("mapsSearch (DataForSEO Google Maps SERP)", () => {
  it("parses maps_search items with the docs' field names", async () => {
    const f = fakeFetch(docs);
    const res = await mapsSearch({ keyword: "ramen restaurant", city: "Irvine", state: "CA" }, deps(f));
    const items = docs.tasks[0].result[0].items;
    expect(res).toEqual({
      status: "ok",
      costUsd: docs.tasks[0].cost,
      items: [
        { title: items[0].title, cid: items[0].cid, category: items[0].category },
        { title: items[1].title, cid: items[1].cid, domain: items[1].domain, rating: 4.7, category: items[1].category },
        { title: items[2].title, cid: items[2].cid, domain: items[2].domain, rating: 4, category: items[2].category },
      ],
    });
  });

  it("posts to maps/live/advanced with location_name and depth", async () => {
    const f = fakeFetch(docs);
    await mapsSearch({ keyword: "ramen restaurant", city: "Irvine", state: "CA" }, deps(f));
    expect(f.mock.calls[0][0]).toBe("https://api.dataforseo.com/v3/serp/google/maps/live/advanced");
    expect(sentBody(f)).toEqual([
      { keyword: "ramen restaurant", location_name: "Irvine,California,United States", language_code: "en", depth: 20 },
    ]);
  });

  it("missing keys → 'missing_keys' without a request", async () => {
    const f = fakeFetch(docs);
    const res = await mapsSearch({ keyword: "k", city: "Irvine", state: "CA" }, deps(f, {}));
    expect(res).toMatchObject({ status: "missing_keys", items: [] });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP 500", () => fakeFetch({ error: "x" }, 500)],
    ["task 40501", () => fakeFetch(fixture("dataforseo/synthetic-task-error-40501.json"))],
    ["top-level 40100", () => fakeFetch(fixture("dataforseo/synthetic-status-40100.json"))],
    ["non-JSON", () => fakeFetch("<html>")],
  ])("%s → 'error', never thrown", async (_, make) => {
    const res = await mapsSearch({ keyword: "k", city: "Irvine", state: "CA" }, deps(make()));
    expect(res.status).toBe("error");
    expect(res.items).toEqual([]);
  });

  it("an unknown state → 'error' without a request", async () => {
    const f = fakeFetch(docs);
    expect((await mapsSearch({ keyword: "k", city: "Irvine", state: "Calif" }, deps(f))).status).toBe("error");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("findLocalCompetitors", () => {
  it("returns the top 5 in Maps order, skipping items without a cid", async () => {
    const f = fakeFetch(irvine);
    const res = await findLocalCompetitors({ cuisine: "ramen", city: "Irvine", state: "CA" }, deps(f));
    expect(sentBody(f)[0].keyword).toBe("ramen restaurant");
    expect(res).toEqual({
      status: "ok",
      items: [
        { name: "Example Ramen House", cid: "9000000000000000001", domain: "example-ramen-house.test", rating: 4.6 },
        { name: "Example Noodle Bar", cid: "9000000000000000002", domain: "example-noodle-bar.test", rating: 4.4 },
        { name: "Example Izakaya", cid: "9000000000000000003", rating: 4.2 },
        { name: "Example Tonkotsu Co.", cid: "9000000000000000004", domain: "example-tonkotsu.test", rating: 4.5 },
        { name: "Example Udon House", cid: "9000000000000000005", domain: "example-udon.test" },
      ],
    });
  });

  it.each(["example-ramen-house.test", "https://www.example-ramen-house.test/menu", "Example-Ramen-House.test"])(
    "excludes the business itself (domain %s) and fills from the next result",
    async (domain) => {
      const res = await findLocalCompetitors(
        { cuisine: "ramen", city: "Irvine", state: "CA", domain },
        deps(fakeFetch(irvine)),
      );
      expect(res.items.map((i) => i.name)).toEqual([
        "Example Noodle Bar",
        "Example Izakaya",
        "Example Tonkotsu Co.",
        "Example Udon House",
        "Example Pho Spot",
      ]);
    },
  );

  it("passes missing_keys and error through with no items", async () => {
    expect(
      await findLocalCompetitors({ cuisine: "ramen", city: "Irvine", state: "CA" }, deps(fakeFetch(irvine), {})),
    ).toMatchObject({
      status: "missing_keys",
      items: [],
    });
    expect(
      await findLocalCompetitors({ cuisine: "ramen", city: "Irvine", state: "CA" }, deps(fakeFetch({}, 503))),
    ).toMatchObject({ status: "error", items: [], error: "HTTP 503" });
  });
});
