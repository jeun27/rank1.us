import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuditView } from "@/components/audit/AuditView";
import { exampleMetrics, exampleRun } from "@/components/audit/example-data";

export const metadata: Metadata = { title: "Audit states", robots: { index: false } };

const NOW = new Date("2026-11-05T14:30:00Z");
// Every 4b audit state with Example data, for visuals and axe. ?state= picks one, so each is its own page.
const STATES = {
  progress: {
    results: exampleRun("running", { done: { chatgpt: 75, gemini: 30, google_aio: 12, perplexity: 25 } }),
    free: false,
  },
  "progress-error": {
    results: exampleRun("running", {
      done: { chatgpt: 75, gemini: 30, google_aio: 0, perplexity: 25 },
      failed: { gemini: 6 },
    }),
    free: false,
  },
  results: { results: exampleRun("complete"), free: false },
  partial: {
    results: exampleRun("partial", { done: { chatgpt: 75, gemini: 75, google_aio: 75, perplexity: 0 } }),
    free: false,
  },
  failed: { results: exampleRun("failed", { done: {} }), free: false },
  "free-progress": {
    results: exampleRun("running", { kind: "free_audit", done: { chatgpt: 40, gemini: 20 } }),
    free: true,
  },
  "free-results": { results: exampleRun("complete", { kind: "free_audit" }), free: true },
} as const;
type GalleryState = keyof typeof STATES;

export default function DevAuditPage({ searchParams }: PageProps<"/dev/audit">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <Suspense>
      <Gallery searchParams={searchParams} />
    </Suspense>
  );
}

async function Gallery({ searchParams }: Pick<PageProps<"/dev/audit">, "searchParams">) {
  const state = String((await searchParams).state ?? "results") as GalleryState;
  const s = STATES[state] ?? notFound();
  return (
    <AuditView
      results={s.results}
      metrics={exampleMetrics}
      free={s.free}
      exportBase={s.free ? "/audit/example-token" : "/app/runs/example-run"}
      now={NOW}
    />
  );
}
