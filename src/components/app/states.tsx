"use client";
import { Banner } from "@/components/ui/Banner";
import { Page } from "./Page";

const block = "animate-pulse rounded-surface bg-white motion-reduce:animate-none";

// loading.tsx: skeleton blocks (UI.md 4b Loading). error.tsx: the screen's banner + 'Try again'.
export function Skeleton({ title }: { title: string }) {
  return (
    <Page title={title}>
      <div aria-hidden className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-28 ${block}`} />
        ))}
      </div>
    </Page>
  );
}

// DQ10: the Dashboard's skeleton is shaped like its success layout (hero + next fix, the Visibility chart,
// the Competitors table), so nothing jumps when results arrive. Sizes follow the measured success blocks.
export function DashboardSkeleton() {
  const heading = <div className={`h-7 w-32 ${block}`} />;
  return (
    <Page title="Dashboard">
      <div aria-hidden className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-start">
        <div data-skeleton="hero" className={`h-38 md:col-span-7 ${block}`} />
        <div data-skeleton="next" className={`h-40 md:col-span-5 md:h-42 ${block}`} />
      </div>
      <div aria-hidden data-skeleton="chart" className="flex flex-col gap-3">
        {heading}
        <div className={`h-46 md:h-56 ${block}`} />
      </div>
      <div aria-hidden data-skeleton="table" className="flex flex-col gap-3">
        {heading}
        <div className={`h-39 ${block}`} />
      </div>
    </Page>
  );
}

export function ErrorState({ title, message, reset }: { title: string; message: string; reset: () => void }) {
  return (
    <Page title={title}>
      <Banner tone="error" action={{ label: "Try again", onClick: reset }}>
        {message}
      </Banner>
    </Page>
  );
}
