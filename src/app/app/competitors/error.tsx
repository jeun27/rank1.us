"use client";
import { ErrorState } from "@/components/app/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Competitors" message="We couldn't load your results. Try again." reset={reset} />;
}
