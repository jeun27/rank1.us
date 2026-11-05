import { loadFreeAudit } from "@/components/audit/load";
import { csvResponse } from "@/components/audit/respond";

export async function GET(_req: Request, ctx: RouteContext<"/audit/[token]/export.csv">) {
  const { token } = await ctx.params;
  return csvResponse(await loadFreeAudit(token));
}
