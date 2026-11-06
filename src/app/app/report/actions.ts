"use server";
import { revalidatePath } from "next/cache";
import { selectedBusinessId } from "@/app/app/current";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { setReportSettings, uploadLogo } from "@/lib/queries/reports";
import { sendTestReport } from "@/lib/reports/service";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// The business is the caller's current one (switcher cookie, validated); RLS and the RPCs decide access.
// Errors return codes only: never an email or a Storage message.
async function current() {
  const db = await createClient();
  return { db, business: await getCurrentBusiness(db, await selectedBusinessId()) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR = /^#[0-9A-F]{6}$/;

export async function saveReportSettings(s: { brand_color: string; report_recipients: string[] }) {
  const { db, business } = await current();
  if (!business) return { error: "no_business" };
  const recipients = [...new Set(s.report_recipients.map((e) => e.trim().toLowerCase()))];
  if (!COLOR.test(s.brand_color) || recipients.length > 10 || !recipients.every((e) => EMAIL.test(e)))
    return { error: "invalid" };
  try {
    await setReportSettings(db, business.id, { brand_color: s.brand_color, report_recipients: recipients });
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/app/report");
}

export async function uploadReportLogo(form: FormData) {
  const { db, business } = await current();
  const file = form.get("logo");
  if (!business || !(file instanceof File)) return { error: "invalid" };
  try {
    const r = await uploadLogo(db, createServiceClient(), business.id, new Uint8Array(await file.arrayBuffer()));
    if (r.status !== "saved") return { error: r.status };
  } catch {
    return { error: "failed" };
  }
  revalidatePath("/app/report");
}

// Last month's report to the signed-in user's own email only (never stored).
export async function sendReportTest(): Promise<
  { status: "sent"; email: string } | { status: "failed" | "not_allowed" }
> {
  const { db, business } = await current();
  const email = (await db.auth.getUser()).data.user?.email;
  if (!business || !email) return { status: "not_allowed" };
  const r = await sendTestReport(db, createServiceClient(), business.id);
  return r === "sent" ? { status: "sent", email: email.toLowerCase() } : { status: r };
}
