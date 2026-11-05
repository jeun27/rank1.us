import { ComparisonTable } from "@/components/site/ComparisonTable";
import { Faq } from "@/components/site/Faq";
import { Features } from "@/components/site/Features";
import { FinalCta } from "@/components/site/FinalCta";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Pricing } from "@/components/site/Pricing";
import { Screenshots } from "@/components/site/Screenshots";
import { SocialProof } from "@/components/site/SocialProof";
import { StickyCta } from "@/components/site/StickyCta";

// Static page: SHOW_SOCIAL_PROOF is read at build time.
export default function Home() {
  return (
    // Bottom padding below md keeps the footer clear of the sticky bar (always reserved, so nothing jumps when it toggles).
    <div className="pb-20 md:pb-0">
      <Header />
      <main>
        <Hero />
        <SocialProof show={process.env.SHOW_SOCIAL_PROOF === "true"} />
        <HowItWorks />
        <Features />
        <Screenshots />
        <ComparisonTable />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <StickyCta />
    </div>
  );
}
