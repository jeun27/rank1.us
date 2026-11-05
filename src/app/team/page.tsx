import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { Placeholder } from "@/components/auth/Placeholder";
import { Workspace } from "@/components/workspace/Workspace";
import { landingPath, signInPath } from "@/lib/auth/next";
import { getLanding } from "@/lib/queries/auth";
import { buildWorkspace } from "@/lib/queries/workspace";
import { createClient } from "@/lib/supabase/server";
import { themeScript } from "@/lib/workspace/prefs";
import { exampleWorkspaceRows } from "./example-data";

export const metadata: Metadata = { title: "Rank1", robots: { index: false } };

// Team users only; everyone else goes to their own home. The workspace (Example data) is off unless ENABLE_TEAM_WORKSPACE=true.
export async function TeamGate() {
  const landing = await getLanding(await createClient());
  if (!landing) redirect(signInPath("/team"));
  if (landing !== "team") redirect(landingPath(landing, null));
  if (process.env.ENABLE_TEAM_WORKSPACE !== "true")
    return (
      <>
        <AppHeader />
        <Placeholder title="Dashboard" />
      </>
    );
  return (
    <>
      {/* Sets data-theme on <html> before first paint (root layout suppresses that one hydration diff). */}
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <Workspace view={buildWorkspace(exampleWorkspaceRows())} />
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense>
      <TeamGate />
    </Suspense>
  );
}
