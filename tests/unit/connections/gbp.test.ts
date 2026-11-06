import { describe, expect, it, vi } from "vitest";
import "./no-live";
import {
  applyEdits,
  diffLocation,
  EDITABLE_FIELDS,
  EditNotAllowed,
  GoogleApiError,
  listAccounts,
  listLocations,
  readLocation,
} from "@/lib/connections/gbp";
import * as fx from "../../fixtures/google";

const BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const route = (routes: Record<string, unknown>) =>
  vi.fn<typeof fetch>(async (input) => {
    const u = new URL(String(input));
    const key = Object.keys(routes).find((k) => `${u.origin}${u.pathname}` === k);
    if (!key) throw new Error(`unexpected call ${u.pathname}`);
    const r = routes[key];
    return r instanceof Response ? r : json(r);
  });

describe("listAccounts / listLocations (the picker)", () => {
  it("pages through accounts with the bearer token", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(fx.accountsPage1))
      .mockResolvedValueOnce(json(fx.accountsPage2));
    const accounts = await listAccounts("ya29.example", { fetch });
    expect(accounts).toEqual([
      { name: "accounts/1000000000000000001", accountName: "Example Owner" },
      { name: "accounts/1000000000000000002", accountName: "Example Restaurant Group" },
    ]);
    const [u1, init] = fetch.mock.calls[0];
    expect(String(u1)).toBe("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer ya29.example");
    expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get("pageToken")).toBe("page-2");
  });

  it("lists an account's locations with only the picker fields", async () => {
    const fetch = route({ [`${BASE}/accounts/1000000000000000001/locations`]: fx.locations });
    expect(await listLocations("t", "accounts/1000000000000000001", { fetch })).toEqual([
      { name: "locations/2000000000000000001", title: "Example Ramen House", address: "1 Example St, Irvine, CA" },
      {
        name: "locations/2000000000000000002",
        title: "Example Ramen House Tustin",
        address: "2 Example Ave, Tustin, CA",
      },
    ]);
    const u = new URL(String(fetch.mock.calls[0][0]));
    expect(u.searchParams.get("readMask")).toBe("name,title,storefrontAddress");
    expect(u.searchParams.get("pageSize")).toBe("100");
  });

  it("rejects a resource name that isn't accounts/<id> before any call", async () => {
    const fetch = vi.fn();
    await expect(listLocations("t", "accounts/1/../../x", { fetch })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("readLocation", () => {
  it("reads only the allowlisted fields + attributes", async () => {
    const fetch = route({
      [`${BASE}/locations/2000000000000000001`]: fx.location,
      [`${BASE}/locations/2000000000000000001/attributes`]: fx.attributes,
    });
    const r = await readLocation("t", "locations/2000000000000000001", { fetch });
    expect(r).toEqual({
      description: "Example ramen in Irvine.",
      regular_hours: fx.location.regularHours,
      special_hours: null,
      website_uri: "https://example.com/",
      primary_phone: "(949) 555-0100",
      attributes: {
        "attributes/has_delivery": fx.attributes.attributes[0],
        "attributes/has_wheelchair_accessible_entrance": fx.attributes.attributes[1],
      },
    });
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("readMask")).toBe(
      "profile,regularHours,specialHours,websiteUri,phoneNumbers",
    );
  });
});

const BEFORE = {
  description: "Example ramen in Irvine.",
  regular_hours: fx.location.regularHours,
  special_hours: null,
  website_uri: "https://example.com/",
  primary_phone: "(949) 555-0100",
  attributes: { "attributes/has_delivery": fx.attributes.attributes[0] },
};

describe("diffLocation", () => {
  it("lists only the allowlisted fields that change, before → after", () => {
    expect(EDITABLE_FIELDS).toEqual([
      "description",
      "regular_hours",
      "special_hours",
      "website_uri",
      "primary_phone",
      "attributes",
    ]);
    const changes = diffLocation(BEFORE, {
      description: "Example ramen and gyoza in Irvine.",
      website_uri: "https://example.com/",
      attributes: {
        "attributes/has_delivery": { name: "attributes/has_delivery", valueType: "BOOL", values: [false] },
      },
    });
    expect(changes).toEqual([
      { field: "description", before: "Example ramen in Irvine.", after: "Example ramen and gyoza in Irvine." },
      {
        field: "attributes",
        before: fx.attributes.attributes[0],
        after: { name: "attributes/has_delivery", valueType: "BOOL", values: [false] },
      },
    ]);
  });

  it.each([["categories"], ["title"], ["storefrontAddress"], ["reviews"], ["phoneNumbers"], ["name"]])(
    "a %s edit is refused (not allowlisted)",
    (field) => {
      expect(() => diffLocation(BEFORE, { [field]: "x" } as never)).toThrow(EditNotAllowed);
    },
  );

  it("an attribute key that isn't attributes/<id>, or a mismatched name, is refused", () => {
    expect(() => diffLocation(BEFORE, { attributes: { has_delivery: { name: "has_delivery" } } } as never)).toThrow(
      EditNotAllowed,
    );
    expect(() =>
      diffLocation(BEFORE, {
        attributes: { "attributes/has_delivery": { name: "attributes/other", values: [true] } },
      } as never),
    ).toThrow(EditNotAllowed);
  });

  it("special hours can't be set on a location without regular hours (the API's rule), unless both are set", () => {
    const special = { specialHourPeriods: [{ startDate: { year: 2026, month: 12, day: 25 }, closed: true }] };
    const noHours = { ...BEFORE, regular_hours: null };
    expect(() => diffLocation(noHours, { special_hours: special })).toThrow(EditNotAllowed);
    expect(diffLocation(noHours, { special_hours: special, regular_hours: fx.location.regularHours })).toHaveLength(2);
    expect(diffLocation(BEFORE, { special_hours: special })).toEqual([
      { field: "special_hours", before: null, after: special },
    ]);
  });

  it("no change → no rows", () => {
    expect(diffLocation(BEFORE, { website_uri: "https://example.com/", description: BEFORE.description })).toEqual([]);
  });
});

describe("applyEdits", () => {
  const LOC = "locations/2000000000000000001";
  const changes = [
    { field: "description", before: "Example ramen in Irvine.", after: "Example ramen and gyoza in Irvine." },
    { field: "primary_phone", before: "(949) 555-0100", after: "(949) 555-0101" },
    {
      field: "attributes",
      before: fx.attributes.attributes[0],
      after: { name: "attributes/has_delivery", valueType: "BOOL", values: [false] },
    },
  ];

  it("validates first, then patches with an updateMask of exactly the changed fields, then logs each field", async () => {
    const fetch = route({ [`${BASE}/${LOC}`]: { name: LOC }, [`${BASE}/${LOC}/attributes`]: fx.attributes });
    const record = vi.fn<(c: { field: string }) => Promise<void>>(async () => {});
    expect(await applyEdits("t", LOC, changes, { fetch, record })).toEqual({ applied: 3 });
    const calls = fetch.mock.calls.map(([u, init]) => {
      const url = new URL(String(u));
      return {
        method: init!.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        body: JSON.parse(String(init!.body)),
      };
    });
    const loc = {
      profile: { description: "Example ramen and gyoza in Irvine." },
      phoneNumbers: { primaryPhone: "(949) 555-0101" },
    };
    const attrs = { name: `${LOC}/attributes`, attributes: [changes[2].after] };
    expect(calls).toEqual([
      {
        method: "PATCH",
        path: `/v1/${LOC}`,
        params: { updateMask: "profile.description,phoneNumbers.primaryPhone", validateOnly: "true" },
        body: loc,
      },
      {
        method: "PATCH",
        path: `/v1/${LOC}`,
        params: { updateMask: "profile.description,phoneNumbers.primaryPhone" },
        body: loc,
      },
      {
        method: "PATCH",
        path: `/v1/${LOC}/attributes`,
        params: { attributeMask: "attributes/has_delivery" },
        body: attrs,
      },
    ]);
    expect(record.mock.calls.map((c) => c[0])).toEqual(changes.map((c) => ({ ...c, providerRef: LOC })));
  });

  it("validation failure → nothing applied, nothing logged", async () => {
    const fetch = route({ [`${BASE}/${LOC}`]: json({ error: { code: 400, message: "Invalid phone" } }, 400) });
    const record = vi.fn<(c: { field: string }) => Promise<void>>(async () => {});
    await expect(applyEdits("t", LOC, changes.slice(0, 2), { fetch, record })).rejects.toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it("the location applies but the attributes fail → only the applied fields are logged", async () => {
    const fetch = route({
      [`${BASE}/${LOC}`]: { name: LOC },
      [`${BASE}/${LOC}/attributes`]: json({ error: { code: 403 } }, 403),
    });
    const record = vi.fn<(c: { field: string }) => Promise<void>>(async () => {});
    const err = await applyEdits("t", LOC, changes, { fetch, record }).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(403);
    expect(record.mock.calls.map((c) => c[0].field)).toEqual(["description", "primary_phone"]);
  });

  it("GoogleApiError carries the status only, never Google's message", async () => {
    const fetch = route({ [`${BASE}/${LOC}`]: json({ error: { message: "Example private detail" } }, 429) });
    const err = await applyEdits("t", LOC, changes.slice(0, 1), { fetch, record: async () => {} }).catch((e) => e);
    expect(err.status).toBe(429);
    expect(String(err)).not.toContain("Example private detail");
  });
});
