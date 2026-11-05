import { describe, expect, it, vi } from "vitest";
import { suggestCompetitors, type KnownCompetitor } from "@/lib/onboarding";
import type { LookupStore } from "@/lib/onboarding/limits";
import { findLocalCompetitors } from "@/lib/onboarding";
import { KEYS, NOW, fakeFetch, fixture } from "../engines/helpers";

// Synthetic Example data only. 8 Maps items in Maps order (built on the docs-structured fixture).
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const base = fixture("maps/synthetic-irvine-ramen.json") as Json;
const extra = ["Example Sushi Bar", "Example Ramen House", "Example Noodle Bar"].map((title, i) => ({
  ...base.tasks[0].result[0].items[0],
  title,
  domain: i === 2 ? "www.example-noodle-bar.test" : `example-extra-${i}.test`,
  cid: `91000000000000000${i}`,
}));
const maps = structuredClone(base);
maps.tasks[0].result[0].items.push(...extra);

const business = {
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  domain: "example-ramen-house.test",
  name: "Example Ramen House",
};

function store(hit?: unknown) {
  const cache = new Map<string, unknown>(hit ? [["k", hit]] : []);
  return {
    cached: vi.fn<LookupStore["cached"]>(async () => (hit ? cache.get("k") : null)),
    take: vi.fn<LookupStore["take"]>(async () => true),
    save: vi.fn<LookupStore["save"]>(async () => {}),
  };
}
const findWith = (body: unknown, env: Record<string, string> = KEYS) =>
  vi.fn<typeof findLocalCompetitors>((q) => findLocalCompetitors(q, { fetch: fakeFetch(body), env, now: NOW }));
const run = (tracked: KnownCompetitor[], dismissed: KnownCompetitor[] = [], s = store(), find = findWith(maps)) =>
  suggestCompetitors({ business, tracked, dismissed }, { store: s, find }).then((r) => ({ r, s, find }));

describe("suggestCompetitors", () => {
  it("minus tracked, dismissed and the business itself, in Maps order, up to 5", async () => {
    const { r, find } = await run(
      [{ name: "Example Noodle Bar", domain: "example-noodle-bar.test" }],
      [{ name: "Example Izakaya" }],
    );
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, cuisine: "ramen", domain: business.domain }),
    );
    expect(r).toEqual({
      status: "ok",
      items: [
        { name: "Example Tonkotsu Co.", cid: "9000000000000000004", domain: "example-tonkotsu.test", rating: 4.5 },
        { name: "Example Udon House", cid: "9000000000000000005", domain: "example-udon.test" },
        { name: "Example Pho Spot", cid: "9000000000000000006", domain: "example-pho.test", rating: 4.1 },
        { name: "Example Soba Stand", cid: "9000000000000000007", domain: "example-soba.test", rating: 4 },
        expect.objectContaining({ name: "Example Sushi Bar", domain: "example-extra-0.test" }),
      ],
    });
  });

  it("matches known competitors by normalized name (case, diacritics, &/and) or bare domain", async () => {
    const { r } = await run([
      { name: "EXAMPLE TONKOTSU CO." },
      { name: "Something Else", domain: "https://www.Example-Udon.test/menu" },
      { name: "Éxample Phó Spot" },
    ]);
    expect(r.items.map((i) => i.name)).not.toEqual(
      expect.arrayContaining(["Example Tonkotsu Co.", "Example Udon House", "Example Pho Spot"]),
    );
    expect(r.items.map((i) => i.name)).toEqual([
      "Example Noodle Bar",
      "Example Izakaya",
      "Example Soba Stand",
      "Example Sushi Bar",
    ]);
  });

  it("dedupes within the results: a later item with a seen name or domain is skipped", async () => {
    const { r } = await run([]);
    const names = r.items.map((i) => i.name);
    expect(names.filter((n) => n === "Example Noodle Bar")).toHaveLength(1);
    expect(names).not.toContain("Example Ramen House");
  });

  it("serves a cached list without a token or a paid call", async () => {
    const cached = { status: "ok", items: [{ name: "Example Cached Place", cid: "1" }] };
    const s = store(cached);
    const { r, find } = await run([], [], s);
    expect(r.items.map((i) => i.name)).toEqual(["Example Cached Place"]);
    expect(s.take).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it("over the maps_lookup limit → limited, no paid call", async () => {
    const s = store();
    s.take.mockResolvedValue(false);
    const { r, find } = await run([], [], s);
    expect(r).toEqual({ status: "limited", items: [] });
    expect(find).not.toHaveBeenCalled();
  });

  it("missing keys → missing_keys with no items, not cached", async () => {
    const s = store();
    const { r } = await run([], [], s, findWith(maps, {}));
    expect(r).toEqual({ status: "missing_keys", items: [] });
    expect(s.save).not.toHaveBeenCalled();
  });

  it("a Maps error or a throwing store → error with no items, never thrown", async () => {
    expect((await run([], [], store(), findWith({}, KEYS))).r).toEqual({ status: "error", items: [] });
    const s = store();
    s.cached.mockRejectedValue(new Error("db down"));
    expect((await run([], [], s)).r).toEqual({ status: "error", items: [] });
  });
});
