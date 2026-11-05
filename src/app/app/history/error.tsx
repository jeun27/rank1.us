"use client";
import { ErrorState } from "@/components/app/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="History" message="We couldn't load your history. Try again." reset={reset} />;
}
