import { loadFreeAudit } from "@/components/audit/load";
import { pngResponse } from "@/components/audit/respond";

export async function GET(_req: Request, ctx: RouteContext<"/audit/[token]/export.png">) {
  const { token } = await ctx.params;
  return pngResponse(await loadFreeAudit(token), true);
}
