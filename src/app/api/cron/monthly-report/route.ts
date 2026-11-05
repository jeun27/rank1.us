import { enqueueMonthlyReports, laPreviousMonthStart } from "@/lib/queries/reports";
import { runMonthly } from "@/lib/reports/process";
import { cronAuthorized } from "@/lib/runs";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron fires this on the 1st at 14:00 and 15:00 UTC (vercel.json); only the 07:xx America/Los_Angeles
// fire proceeds. It only enqueues last month's reports; the run-jobs cron renders and sends them.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization")))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const out = await runMonthly({
    enqueue: (month) => enqueueMonthlyReports(createServiceClient(), month),
    previousMonth: laPreviousMonthStart,
  });
  return Response.json(out.body, { status: out.status });
}
