import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "App states", robots: { index: false } };

// 404 in production, like /dev/ui.
export default function DevAppPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <Suspense>
      <div className="mx-auto flex max-w-page flex-col md:flex-row">
        <Gallery />
      </div>
    </Suspense>
  );
}
