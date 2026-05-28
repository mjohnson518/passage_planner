import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { PricingSection } from "./components/marketing/PricingSection";
import { Header } from "./components/layout/Header";
import { LandingHero } from "./_components/LandingHero";
import { LandingFeatures } from "./_components/LandingFeatures";
import { LandingProcess } from "./_components/LandingProcess";
import { LandingFooter } from "./_components/LandingFooter";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Helmwise — AI-Powered Maritime Passage Planning",
  description:
    "Plan safer voyages with Helmwise. AI-assisted weather, tidal, route, and safety analysis for mariners.",
};

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Helmwise",
    url: "https://helmwise.co",
    description: "AI-powered maritime passage planning for safer voyages.",
    sameAs: [],
  };

  return (
    <>
      {/* JSON-LD structured data for SEO — trusted, statically-derived content (not user input) */}
      {/* oxlint-disable-next-line react-doctor/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      {/* Hero Section — Night Watch */}
      <LandingHero />

      {/* Features Section — 3-col dark glass */}
      <LandingFeatures />

      {/* How it Works — 2-col: step list + visual card */}
      <LandingProcess />

      {/* Pricing Section */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* CTA Section — deep dark navy */}
      <section
        className="relative px-4 py-28 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 5%) 100%)",
        }}
      >
        {/* Chart grid */}
        <div className="absolute inset-0 chart-grid opacity-[0.07]" />
        {/* Glow center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,242,195,0.04) 0%, transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center reveal-on-scroll">
          <span className="eyebrow-night mb-6 block">Get Started</span>
          <h2 className="font-display text-white text-balance">
            Ready to Navigate Smarter?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
            AI-powered passage planning with real-time weather, tidal analysis,
            and comprehensive safety briefings. Your first 14 days are free.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="btn-seafoam group h-14 px-8 text-base"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                className="btn-night-outline h-14 px-8 text-base"
              >
                Talk to Sales
              </Button>
            </Link>
          </div>

          <p className="mt-8 font-mono-data text-xs text-white/25">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer — full dark navy */}
      <LandingFooter />
    </>
  );
}
