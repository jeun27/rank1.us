import type { Metadata } from "next";
import { Placeholder } from "@/components/auth/Placeholder";

export const metadata: Metadata = { title: "Dashboard - Rank1", robots: { index: false } };

// Step 8 builds the owner dashboard.
export default function DashboardPage() {
  return <Placeholder title="Dashboard" />;
}
