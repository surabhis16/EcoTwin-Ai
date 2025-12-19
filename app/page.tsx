import { HeroSection } from "@/components/hero-section"
import { StatsSection } from "@/components/stats-section"
import { FeaturesSection } from "@/components/features-section"
import { CTASection } from "@/components/cta-section"
import { Navigation } from "@/components/navigation"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <CTASection />
    </main>
  )
}
