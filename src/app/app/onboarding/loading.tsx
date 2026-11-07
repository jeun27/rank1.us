import { copy } from "./copy";

// QA F1: onboarding's own loading state. Without it, /app's Dashboard skeleton (h1 "Dashboard") painted first.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
      <h1 className="heading-gradient mb-8 font-display text-title font-semibold tracking-[-0.02em]">{copy.title}</h1>
      <div aria-hidden className="h-15 max-w-110 animate-pulse rounded-nested bg-raised motion-reduce:animate-none" />
    </main>
  );
}
