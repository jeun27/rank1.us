import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { landingPath, signInPath } from "@/lib/auth/next";
import { getLanding, type Landing } from "@/lib/queries/auth";
import { createClient } from "@/lib/supabase/server";

const AREA: Record<Landing, "/app" | "/team" | "/client"> = {
  onboarding: "/app",
  dashboard: "/app",
  team: "/team",
  dfy_client: "/client",
};

// Renders children only for the role that owns the area; everyone else goes to their own home.
export async function AreaGate({ area, children }: { area: "/app" | "/team" | "/client"; children: ReactNode }) {
  const landing = await getLanding(await createClient());
  if (!landing) redirect(signInPath(area));
  if (AREA[landing] !== area) redirect(landingPath(landing, null));
  return <>{children}</>;
}
