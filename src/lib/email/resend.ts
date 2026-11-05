import "server-only";
import type { ContactInput } from "@/lib/spam/validate";

// https://resend.com/docs/api-reference/emails/send-email
export const RESEND_URL = "https://api.resend.com/emails";

export type Email = { from: string; to: string; reply_to: string; subject: string; text: string };

// Null when CONTACT_FROM_EMAIL or CONTACT_TO_EMAIL is missing.
export function contactEmail(c: ContactInput, env: Record<string, string | undefined> = process.env): Email | null {
  if (!env.CONTACT_FROM_EMAIL || !env.CONTACT_TO_EMAIL) return null;
  return {
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    reply_to: c.email,
    subject: `Contact us: ${c.tier} from ${c.company ?? c.name}`,
    text: [`Name: ${c.name}`, `Email: ${c.email}`, `Company: ${c.company ?? "-"}`, `Tier: ${c.tier}`, "", c.message].join("\n"),
  };
}

// True only on a 2xx from Resend. Never logs the payload.
export async function sendEmail(email: Email, idempotencyKey: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(email),
    });
    if (!res.ok) console.error("resend: send failed", res.status);
    return res.ok;
  } catch {
    console.error("resend: network error");
    return false;
  }
}
