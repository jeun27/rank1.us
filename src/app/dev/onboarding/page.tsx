import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "Onboarding states", robots: { index: false } };

// Every 4b onboarding state with Example data, for visuals and axe. 404 in production like /dev/ui.
export default function DevOnboardingPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 md:px-8">
      <h1 className="font-display text-display font-semibold">Onboarding states</h1>
      <Gallery />
    </main>
  );
}
