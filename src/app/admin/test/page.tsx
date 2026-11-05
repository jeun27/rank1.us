import type { Metadata } from "next";
import { EngineTestForm } from "@/components/admin/EngineTestForm";
import { adminCopy as c } from "@/lib/admin/copy";
import { requireFounder } from "@/lib/admin/founder";
import { missingKeys } from "@/lib/engines";
import { runEngineTest } from "./actions";

// Reads the session at request time, so it is not prerendered. Proxy sends the real 404 status.
export const instant = false;

export const metadata: Metadata = { title: "Engine test - Rank1", robots: { index: false, follow: false } };

// Founder only (FOUNDER_EMAIL); everyone else gets a 404. Live calls cost money, so one run per click.
export default async function EngineTestPage() {
  await requireFounder();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-16">
      <h1 className="mb-8 font-display text-display font-semibold">{c.title}</h1>
      <EngineTestForm missing={missingKeys()} action={runEngineTest} />
    </main>
  );
}
