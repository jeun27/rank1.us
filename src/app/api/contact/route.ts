import { contactEmail, sendEmail } from "@/lib/email/resend";
import {
  countRecentContactRequests,
  insertContactRequest,
  markContactRequestEmailed,
} from "@/lib/queries/contactRequests";
import { clientIp, hashIp } from "@/lib/spam/ipHash";
import { CONTACT_LIMIT, contactWindowStart, honeypotFilled } from "@/lib/spam/rateLimit";
import { readBody } from "@/lib/spam/readBody";
import { verifyTurnstile } from "@/lib/spam/turnstile";
import { TURNSTILE_FIELD, validateContact } from "@/lib/spam/validate";
import { createServiceClient } from "@/lib/supabase/service";
import type { DbClient } from "@/lib/queries/client";

// Runs on the Node.js runtime (the default). cacheComponents rejects the "runtime" segment config.

// Order: validate, honeypot, Turnstile, rate limit, store, email. Never logs the message or addresses.
export async function POST(req: Request) {
  const body = await readBody(req);
  if (!body) return Response.json({ errors: [] }, { status: 400 });
  const check = validateContact(body);
  if (!check.ok) return Response.json({ errors: check.errors }, { status: 400 });
  if (honeypotFilled(body)) return Response.json({ ok: true });

  const ip = clientIp(req);
  if (!(await verifyTurnstile(body[TURNSTILE_FIELD], ip)))
    return Response.json({ error: "turnstile" }, { status: 403 });

  let db: DbClient;
  let id: string;
  try {
    db = createServiceClient();
    const ipHash = hashIp(ip);
    if ((await countRecentContactRequests(db, ipHash, contactWindowStart(new Date()))) >= CONTACT_LIMIT) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    id = await insertContactRequest(db, {
      ...check.data,
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch {
    console.error("contact: store failed");
    return Response.json({ error: "server" }, { status: 500 });
  }

  // The row stays with emailed=false when the email does not go out.
  const email = contactEmail(check.data);
  if (!email || !(await sendEmail(email, `contact-${id}`))) return Response.json({ error: "email" }, { status: 502 });
  try {
    await markContactRequestEmailed(db, id);
  } catch {
    console.error("contact: emailed flag not saved"); // the email went out, so still a success
  }
  return Response.json({ ok: true });
}
