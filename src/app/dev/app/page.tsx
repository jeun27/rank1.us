import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "App states", robots: { index: false } };

// 404 in production, like /dev/ui. Read on the server, so states render without JavaScript too.
export default function DevAppPage({ searchParams }: PageProps<"/dev/app">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <Suspense>
      <div className="mx-auto flex max-w-page flex-col md:flex-row">
        <Params searchParams={searchParams} />
      </div>
    </Suspense>
  );
}

async function Params({ searchParams }: Pick<PageProps<"/dev/app">, "searchParams">) {
  const p = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <Gallery state={one(p.state)} location={one(p.location)} />;
}
