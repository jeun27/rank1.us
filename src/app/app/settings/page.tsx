import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { appCopy } from "@/components/app/copy";
import { Page } from "@/components/app/Page";
import { connectionsCopy } from "@/components/connections/copy";
import { narrativeCopy } from "@/components/narrative/copy";

export const metadata: Metadata = { title: "Settings - Rank1", robots: { index: false } };

// The Settings index: the sections whose flag is on (Connections C-a, How should AI describe you? G4).
// One section goes straight to it. The proxy 404s this when neither flag is on.
export default function SettingsPage() {
  const sections = [
    process.env.ENABLE_CONNECTIONS === "true" && { href: "/app/settings/connections", label: connectionsCopy.title },
    process.env.ENABLE_NARRATIVE === "true" && { href: "/app/settings/narrative", label: narrativeCopy.settingsTitle },
  ].filter((s): s is { href: string; label: string } => Boolean(s));
  if (sections.length === 1) redirect(sections[0].href);
  return (
    <Page title={appCopy.settings}>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex min-h-11 items-center text-ui text-link underline underline-offset-4 md:min-h-8"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
