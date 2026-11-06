import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "Team workspace states", robots: { index: false } };

// The team workspace on Example data (#11's gallery, no sign-in). 404 in production, like /dev/app.
export default function DevTeamPage({ searchParams }: PageProps<"/dev/team">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <Suspense>
        <State searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function State({ searchParams }: Pick<PageProps<"/dev/team">, "searchParams">) {
  const s = (await searchParams).state;
  return <Gallery state={typeof s === "string" ? s : undefined} />;
}
