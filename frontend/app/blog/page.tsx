import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import {
  Anchor,
  PenLine,
  ArrowRight,
  Cloud,
  Waves,
  Shield,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Blog - Helmwise",
  description:
    "Helmwise blog is coming soon. Maritime safety insights, passage planning tips, and platform updates.",
  robots: { index: false, follow: true },
};

export default function BlogPage() {
  return (
    <>
      <Header />

      {/* Hero */}
      <section className="section-hero relative px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 chart-grid opacity-20 pointer-events-none"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="badge-brass mb-4 inline-block">Coming Soon</span>
          <h1 className="font-display mt-4 text-balance">
            Helmwise <span className="text-gradient">Journal</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            We&apos;re preparing long-form pieces on maritime safety, passage
            planning best practices, weather interpretation, and platform
            updates. First issues land soon.
          </p>
        </div>
      </section>

      {/* Topics */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="card-nautical p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <PenLine className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl mb-2">
                  What we&apos;ll cover
                </h2>
                <p className="text-muted-foreground">
                  Grounded in real passage planning, not generic listicles.
                </p>
              </div>
            </div>

            <div className="divider-nautical" />

            <div className="grid sm:grid-cols-3 gap-6 mt-4">
              {[
                {
                  icon: Cloud,
                  title: "Weather Interpretation",
                  description:
                    "Reading GRIBs, buoy reports, and multi-model disagreement.",
                },
                {
                  icon: Waves,
                  title: "Tidal Windows",
                  description:
                    "Planning around currents, depth gates, and stale-data risks.",
                },
                {
                  icon: Shield,
                  title: "Safety Frameworks",
                  description:
                    "GO / CAUTION / NO-GO thinking and conservative margins.",
                },
              ].map((topic, i) => (
                <div key={i}>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brass/10 text-brass mb-3">
                    <topic.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base mb-1">{topic.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {topic.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-ocean px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-primary-foreground">
            Plan Your Next Passage Now
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            The journal is coming. The platform is here.
          </p>
          <div className="mt-8">
            <Link href="/features">
              <Button size="lg" className="btn-brass group">
                Explore Features
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">Helmwise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link
                href="/terms"
                className="hover:text-primary transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-primary transition-colors"
              >
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
