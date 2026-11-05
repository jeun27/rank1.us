import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { AreaGate } from "@/components/auth/AreaGate";
import { Placeholder } from "@/components/auth/Placeholder";
import { Workspace } from "@/components/workspace/Workspace";
import { buildWorkspace } from "@/lib/queries/workspace";
import { themeScript } from "@/lib/workspace/prefs";
import { exampleWorkspaceRows } from "./example-data";

export const metadata: Metadata = { title: "Rank1", robots: { index: false } };

// The workspace (Example data) is off unless ENABLE_TEAM_WORKSPACE=true.
export function TeamView() {
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
      <AreaGate area="/team">
        <TeamView />
      </AreaGate>
    </Suspense>
  );
}
