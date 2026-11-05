import { loadPaidRun } from "@/components/audit/load";
import { csvResponse } from "@/components/audit/respond";

// Members only: RLS returns nothing for another workspace's run, so it 404s.
export async function GET(_req: Request, ctx: RouteContext<"/app/runs/[runId]/export.csv">) {
  const { runId } = await ctx.params;
  return csvResponse(await loadPaidRun(runId));
}
