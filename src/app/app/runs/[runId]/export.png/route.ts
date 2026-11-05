import { loadPaidRun } from "@/components/audit/load";
import { pngResponse } from "@/components/audit/respond";

// Members only: RLS returns nothing for another workspace's run, so it 404s.
export async function GET(_req: Request, ctx: RouteContext<"/app/runs/[runId]/export.png">) {
  const { runId } = await ctx.params;
  return pngResponse(await loadPaidRun(runId), false);
}
