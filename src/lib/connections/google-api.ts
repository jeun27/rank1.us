// Shared Google REST helpers: bearer calls that keep only the HTTP status on failure, and paging.
const MAX_PAGES = 50;

// The status only: Google's error text can carry account details, so it's never kept.
export class GoogleApiError extends Error {
  constructor(readonly status: number) {
    super(`google_api_${status}`);
  }
}
export type Deps = { fetch?: typeof fetch };

export async function call(token: string, url: string, deps: Deps, init: { method?: string; body?: unknown } = {}) {
  const res = await (deps.fetch ?? fetch)(url, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!res.ok) throw new GoogleApiError(res.status);
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function paged<T>(token: string, url: string, key: string, deps: Deps): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const u = new URL(url);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const body = await call(token, u.toString(), deps);
    out.push(...((body[key] as T[] | undefined) ?? []));
    pageToken = body.nextPageToken as string | undefined;
    if (!pageToken) break;
  }
  return out;
}
