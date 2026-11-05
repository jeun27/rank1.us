import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { SimplePage } from "@/components/contact/SimplePage";
import { Card } from "@/components/ui/Card";
import { authCopy as c } from "@/lib/auth/copy";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "Sign in - Rank1", robots: { index: false } };

type Query = Awaited<PageProps<"/signin">["searchParams"]>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// The frame prerenders; only the form waits for the query (next and error).
async function Form({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const error = one(q.error);
  return <SignInForm next={safeNext(one(q.next))} error={error === "google" || error === "link" ? error : undefined} />;
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <SimplePage title={c.title}>
      <Card className="max-w-md">
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </SimplePage>
  );
}
