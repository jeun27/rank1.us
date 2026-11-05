import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/Workspace";
import { buildWorkspace } from "@/lib/queries/workspace";
import { themeScript } from "@/lib/workspace/prefs";
import { exampleWorkspaceRows } from "./example-data";

export const metadata: Metadata = { title: "Rank1", robots: { index: false } };

// Team workspace, read-only Example data until sign-in exists. Off unless ENABLE_TEAM_WORKSPACE=true.
export default function TeamPage() {
  if (process.env.ENABLE_TEAM_WORKSPACE !== "true") notFound();
  const view = buildWorkspace(exampleWorkspaceRows());
  return (
    <>
      {/* Sets data-theme on <html> before first paint (root layout suppresses that one hydration diff). */}
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <Workspace view={view} />
    </>
  );
}
