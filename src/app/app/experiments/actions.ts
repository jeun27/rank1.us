"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NewTest } from "@/components/experiments/ExperimentForm";
import { createExperiment, deleteExperiment, endExperiment } from "@/lib/queries/experiments";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";
import { selectedBusinessId } from "../current";

const code = (e: unknown) => ({ error: (e as { code?: string }).code ?? "failed" });

// The business comes from the session's own selection, never from the browser. RLS and
// create_experiment check the role and the group rules again (a dfy_client is refused).
export async function createExperimentAction(t: NewTest) {
  const db = await createClient();
  try {
    const business = await getCurrentBusiness(db, await selectedBusinessId());
    if (!business) return { error: "no_business" };
    await createExperiment(db, {
      businessId: business.id,
      test: t.test,
      control: t.control,
      fixId: t.fixId,
      name: t.name || undefined,
      changeNote: t.changeNote,
      changeUrl: t.changeUrl,
      changeDate: t.changeDate,
    });
  } catch (e) {
    return code(e);
  }
  revalidatePath("/app/experiments");
  redirect("/app/experiments");
}

export async function endExperimentAction(id: string) {
  try {
    if (!(await endExperiment(await createClient(), id))) return { error: "not_allowed" };
  } catch (e) {
    return code(e);
  }
  revalidatePath("/app/experiments");
}

export async function deleteExperimentAction(id: string) {
  try {
    if (!(await deleteExperiment(await createClient(), id))) return { error: "not_allowed" };
  } catch (e) {
    return code(e);
  }
  revalidatePath("/app/experiments");
}
