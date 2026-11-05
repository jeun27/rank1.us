import { randomBytes } from "node:crypto";
import { countLeadsSince, insertLead } from "@/lib/queries/leads";
import { clientIp, hashIp } from "@/lib/spam/ipHash";
import { auditDailyLimit, honeypotFilled, utcDayStart } from "@/lib/spam/rateLimit";
import { readBody } from "@/lib/spam/readBody";
import { verifyTurnstile } from "@/lib/spam/turnstile";
import { TURNSTILE_FIELD, validateAudit } from "@/lib/spam/validate";
import { createServiceClient } from "@/lib/supabase/service";

// Runs on the Node.js runtime (the default). cacheComponents rejects the "runtime" segment config.

const queued = () => Response.json({ status: "queued" }, { status: 202 });

// Stub: stores a lead and answers 202. Step 7 starts the audit run.
export async function POST(req: Request) {
  const body = await readBody(req);
  if (!body) return Response.json({ errors: [] }, { status: 400 });
  const check = validateAudit(body);
  if (!check.ok) return Response.json({ errors: check.errors }, { status: 400 });
  if (honeypotFilled(body)) return queued();

  const ip = clientIp(req);
  if (!(await verifyTurnstile(body[TURNSTILE_FIELD], ip))) return Response.json({ error: "turnstile" }, { status: 403 });

  try {
    const db = createServiceClient();
    if ((await countLeadsSince(db, utcDayStart(new Date()))) >= auditDailyLimit()) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    await insertLead(db, { ...check.data, ip_hash: hashIp(ip), token: randomBytes(32).toString("base64url") });
  } catch {
    console.error("audit request: failed");
    return Response.json({ error: "server" }, { status: 500 });
  }
  return queued();
}
