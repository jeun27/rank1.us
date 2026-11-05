"use server";
import { revalidatePath } from "next/cache";
import { setFixStatus, type FixStatus } from "@/lib/queries/fixes";
import { createClient } from "@/lib/supabase/server";

// RLS and set_fix_status decide who may change which fix; the browser only names it.
export async function setFixStatusAction(fixId: string, status: FixStatus) {
  try {
    await setFixStatus(await createClient(), fixId, status);
  } catch (e) {
    return { error: (e as { code?: string }).code ?? "failed" };
  }
  revalidatePath("/app/fixes");
  revalidatePath("/app");
}
