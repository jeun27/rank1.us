// Google Business Profile: the location picker, reads of the allowlisted fields, and diff + patch.
// Docs: accounts.list https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
// locations (list, get, patch, getAttributes, updateAttributes):
// https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations
// API access needs Google's approval first (0 QPM until then): https://developers.google.com/my-business/content/prereqs

import { call, paged, type Deps } from "./google-api";

export { GoogleApiError } from "./google-api";

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";

// v1 edit allowlist (lead, 2026-11-06). Everything else is read-only: no categories, title, address,
// reviews, review replies or manager/ownership changes.
export const EDITABLE_FIELDS = [
  "description",
  "regularHours",
  "specialHours",
  "websiteUri",
  "primaryPhone",
  "attributes",
] as const;

export type Attribute = { name: string; valueType?: string; values?: unknown[]; [k: string]: unknown };
export type GbpFields = {
  description: string | null;
  regularHours: unknown;
  specialHours: unknown;
  websiteUri: string | null;
  primaryPhone: string | null;
  attributes: Record<string, Attribute>;
};
export type GbpEdit = Partial<GbpFields>;
// field = one of EDITABLE_FIELDS (not attributes) or "attributes/<id>".
export type Change = { field: string; before: unknown; after: unknown };

export class EditNotAllowed extends Error {
  constructor(readonly field: string) {
    super(`edit_not_allowed:${field}`);
  }
}

const ACCOUNT_NAME = /^accounts\/\d+$/;
const LOCATION_NAME = /^locations\/\d+$/;
const ATTRIBUTE_NAME = /^attributes\/[a-z0-9_]+$/;
const checkName = (name: string, re: RegExp) => {
  if (!re.test(name)) throw new Error("bad resource name");
};

export async function listAccounts(token: string, deps: Deps = {}) {
  const accounts = await paged<{ name: string; accountName?: string }>(
    token,
    `${ACCOUNTS}?pageSize=20`,
    "accounts",
    deps,
  );
  return accounts.map((a) => ({ name: a.name, accountName: a.accountName ?? "" }));
}

type RawLocation = {
  name: string;
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
};

export async function listLocations(token: string, account: string, deps: Deps = {}) {
  checkName(account, ACCOUNT_NAME);
  const url = `${INFO}/${account}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
  const locations = await paged<RawLocation>(token, url, "locations", deps);
  return locations.map((l) => {
    const a = l.storefrontAddress;
    const address = a ? [...(a.addressLines ?? []), a.locality, a.administrativeArea].filter(Boolean).join(", ") : "";
    return { name: l.name, title: l.title ?? "", address };
  });
}

export async function readLocation(token: string, location: string, deps: Deps = {}): Promise<GbpFields> {
  checkName(location, LOCATION_NAME);
  const [loc, attrs] = await Promise.all([
    call(token, `${INFO}/${location}?readMask=profile,regularHours,specialHours,websiteUri,phoneNumbers`, deps),
    call(token, `${INFO}/${location}/attributes`, deps),
  ]);
  const profile = loc.profile as { description?: string } | undefined;
  const phones = loc.phoneNumbers as { primaryPhone?: string } | undefined;
  return {
    description: profile?.description ?? null,
    regularHours: loc.regularHours ?? null,
    specialHours: loc.specialHours ?? null,
    websiteUri: (loc.websiteUri as string | undefined) ?? null,
    primaryPhone: phones?.primaryPhone ?? null,
    attributes: Object.fromEntries(((attrs.attributes as Attribute[] | undefined) ?? []).map((a) => [a.name, a])),
  };
}

// Stable JSON (sorted keys) so key order never fakes a change.
const stable = (v: unknown): string =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? `[${v.map(stable).join(",")}]`
      : `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
    : JSON.stringify(v ?? null);

// Before → after for each allowlisted field that changes. Any other field is refused before any call.
export function diffLocation(before: GbpFields, proposed: GbpEdit): Change[] {
  for (const key of Object.keys(proposed))
    if (!(EDITABLE_FIELDS as readonly string[]).includes(key)) throw new EditNotAllowed(key);
  const changes: Change[] = [];
  for (const field of EDITABLE_FIELDS) {
    if (field === "attributes" || !(field in proposed)) continue;
    const after = proposed[field] ?? null;
    if (stable(after) !== stable(before[field])) changes.push({ field, before: before[field] ?? null, after });
  }
  // The API refuses specialHours without regularHours on the location.
  const regular = "regularHours" in proposed ? proposed.regularHours : before.regularHours;
  if (proposed.specialHours && !regular) throw new EditNotAllowed("specialHours");
  for (const [name, attr] of Object.entries(proposed.attributes ?? {})) {
    if (!ATTRIBUTE_NAME.test(name) || attr?.name !== name) throw new EditNotAllowed(name);
    const prev = before.attributes[name] ?? null;
    if (stable(attr) !== stable(prev)) changes.push({ field: name, before: prev, after: attr });
  }
  return changes;
}

// Field → (updateMask path, request body part). Only these paths ever reach updateMask.
const MASK: Record<Exclude<(typeof EDITABLE_FIELDS)[number], "attributes">, (v: unknown) => [string, object]> = {
  description: (v) => ["profile.description", { profile: { description: v } }],
  regularHours: (v) => ["regularHours", { regularHours: v }],
  specialHours: (v) => ["specialHours", { specialHours: v }],
  websiteUri: (v) => ["websiteUri", { websiteUri: v }],
  primaryPhone: (v) => ["phoneNumbers.primaryPhone", { phoneNumbers: { primaryPhone: v } }],
};

const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b))
    out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] ? merge(out[k] as never, v as never) : v;
  return out;
};

// Applies diffLocation's changes: location fields are checked with validateOnly first, then patched with an
// updateMask of exactly those fields; attributes go through updateAttributes with an attributeMask. Each
// applied field is logged (record) right after Google accepts it, so a partial failure logs only what applied.
export async function applyEdits(
  token: string,
  location: string,
  changes: Change[],
  deps: Deps & { record: (c: Change & { providerRef: string }) => Promise<void> },
): Promise<{ applied: number }> {
  checkName(location, LOCATION_NAME);
  const fields = changes.filter((c) => c.field in MASK);
  const attrs = changes.filter((c) => ATTRIBUTE_NAME.test(c.field));
  if (fields.length + attrs.length !== changes.length) throw new EditNotAllowed("unknown");

  if (fields.length) {
    const parts = fields.map((c) => MASK[c.field as keyof typeof MASK](c.after));
    const mask = parts.map((p) => p[0]).join(",");
    const body = parts.reduce((acc, p) => merge(acc, p[1] as Record<string, unknown>), {} as Record<string, unknown>);
    const url = `${INFO}/${location}?updateMask=${encodeURIComponent(mask)}`;
    await call(token, `${url}&validateOnly=true`, deps, { method: "PATCH", body });
    await call(token, url, deps, { method: "PATCH", body });
    for (const c of fields) await deps.record({ ...c, providerRef: location });
  }
  if (attrs.length) {
    const mask = attrs.map((c) => c.field).join(",");
    await call(token, `${INFO}/${location}/attributes?attributeMask=${encodeURIComponent(mask)}`, deps, {
      method: "PATCH",
      body: { name: `${location}/attributes`, attributes: attrs.map((c) => c.after) },
    });
    for (const c of attrs) await deps.record({ ...c, providerRef: location });
  }
  return { applied: changes.length };
}
