import { enqueueWeeklyRuns, pruneEphemeral } from "@/lib/queries/weekly";
import { cronAuthorized, runWeekly } from "@/lib/runs";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron fires this Mondays at 13:00 and 14:00 UTC (vercel.json); only the 06:xx America/Los_Angeles
// fire proceeds. It only enqueues weekly runs (the run-jobs cron drains them) and prunes the 24 h cache.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization")))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  let db: ReturnType<typeof createServiceClient> | null = null;
  const service = () => (db ??= createServiceClient());
  const out = await runWeekly({
    enqueue: (weekStart) => enqueueWeeklyRuns(service(), weekStart),
    prune: () => pruneEphemeral(service()),
  });
  return Response.json(out.body, { status: out.status });
}
