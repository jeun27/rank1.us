import { notifyFreeAuditsWith } from "@/lib/audit/service";
import { checkFixesWith } from "@/lib/fixes/service";
import { claimJobs } from "@/lib/queries/run-jobs";
import { batchSize, cronAuthorized, drainJobs, processJob, serviceRunsDb } from "@/lib/runs";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron calls this every minute (vercel.json, production only). Reading the request headers makes it
// dynamic; cacheComponents rejects the "dynamic" segment config. drainJobs stops well inside this limit.
export const maxDuration = 300;

export async function GET(req: Request) {
  const started = Date.now();
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
    // Then email free audits that finished (one per lead; failed runs are marked without an email).
    const notified = await notifyFreeAuditsWith(db);
    // Then at most one closed paid run's site checks, only with ≥60 s of maxDuration left (Step 10).
    const fixes = await checkFixesWith(db, () => maxDuration * 1000 - (Date.now() - started));
    return Response.json({ ...summary, notified, fixes });
  } catch (e) {
    // No DB error text in the body (Step 6 QA): a fixed label, with only the PG code logged.
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "error";
    console.error(`run-jobs: claim failed (${code})`);
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }
}
