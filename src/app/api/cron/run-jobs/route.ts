import { claimJobs } from "@/lib/queries/run-jobs";
import { batchSize, cronAuthorized, drainJobs, processJob, serviceRunsDb } from "@/lib/runs";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron calls this every minute (vercel.json, production only). Reading the request headers makes it
// dynamic; cacheComponents rejects the "dynamic" segment config. drainJobs stops well inside this limit.
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization")))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const db = createServiceClient();
    const runsDb = serviceRunsDb(db);
    const summary = await drainJobs({
      claim: (limit) => claimJobs(db, limit),
      process: (job) => processJob(job, { db: runsDb }),
      batch: batchSize(),
    });
    return Response.json(summary);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "error";
    return Response.json({ error: `claim_jobs: ${message.slice(0, 200)}` }, { status: 500 });
  }
}
