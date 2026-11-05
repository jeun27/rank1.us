"use client";
import { Banner } from "@/components/ui/Banner";
import { Page } from "./Page";

// loading.tsx: skeleton blocks (UI.md 4b Loading). error.tsx: the screen's banner + 'Try again'.
export function Skeleton({ title }: { title: string }) {
  return (
    <Page title={title}>
      <div aria-hidden className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-surface bg-white motion-reduce:animate-none" />
        ))}
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
