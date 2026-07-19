import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingFeatures } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <HowItWorks />
      <Benefits />
      <Testimonials />
      <Pricing />
      <Faq />
      <LandingFooter />
    </main>
  );
}
