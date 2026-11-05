import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";
import { SimplePage } from "@/components/contact/SimplePage";
import { Card } from "@/components/ui/Card";
import { authCopy as c } from "@/lib/auth/copy";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "Sign in - Rank1", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const error = one(q.error);
  return (
    <SimplePage title={c.title}>
      <Card className="max-w-md">
        <SignInForm next={safeNext(one(q.next))} error={error === "google" || error === "link" ? error : undefined} />
      </Card>
    </SimplePage>
  );
}
