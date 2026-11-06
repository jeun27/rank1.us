import { paged, type Deps } from "./google-api";

// GA4 shell (read-only; analytics.readonly): the properties for a picker. Reports come later.
// https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list
type Summary = { displayName?: string; propertySummaries?: { property: string; displayName?: string }[] };

export async function listGa4Properties(token: string, deps: Deps = {}) {
  const url = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200";
  const summaries = await paged<Summary>(token, url, "accountSummaries", deps);
  return summaries.flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({
      property: p.property,
      displayName: p.displayName ?? "",
      account: a.displayName ?? "",
    })),
  );
}
