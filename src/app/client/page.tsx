import type { Metadata } from "next";
import { Placeholder } from "@/components/auth/Placeholder";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

// Step 12 builds the done-for-you client view.
export default function ClientPage() {
  return <Placeholder title="Dashboard" />;
}
