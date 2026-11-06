import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "Client states", robots: { index: false } };

// The DFY client dashboard on Example data (Step 12), under the same header as the real /client layout
// (with the theme toggle, D40). 404 in production, like /dev/app.
export default function DevClientPage({ searchParams }: PageProps<"/dev/client">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <AppHeader />
      <Suspense>
        <State searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function State({ searchParams }: Pick<PageProps<"/dev/client">, "searchParams">) {
  const s = (await searchParams).state;
  return <Gallery state={typeof s === "string" ? s : undefined} />;
}
