import type { Metadata } from "next";
import { Placeholder } from "@/components/auth/Placeholder";

export const metadata: Metadata = { title: "Add your business - Rank1", robots: { index: false } };

// Step 5 builds onboarding.
export default function OnboardingPage() {
  return <Placeholder title="Add your business" />;
}
