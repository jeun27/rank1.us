"use client";
import { ErrorState } from "@/components/app/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="What to fix next" message="We couldn't load your results. Try again." reset={reset} />;
}
