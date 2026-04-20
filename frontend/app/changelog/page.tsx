import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import {
  Anchor,
  History,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog - Helmwise",
  description:
    "Helmwise changelog is coming soon. Stay up to date with the latest features, improvements, and fixes to our passage planning platform.",
  robots: { index: false, follow: true },
};

export default function ChangelogPage() {
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
            Helmwise <span className="text-gradient">Changelog</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            A public record of what&apos;s shipped, what&apos;s fixed, and
            what&apos;s coming next. Launching soon.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="card-nautical p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <History className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl mb-2">
                  What we&apos;ll track
                </h2>
                <p className="text-muted-foreground">
                  Every release, categorised so you can scan for what matters to
                  your passage planning.
                </p>
              </div>
            </div>

            <div className="divider-nautical" />

            <div className="grid sm:grid-cols-3 gap-6 mt-4">
              {[
                {
                  icon: Sparkles,
                  title: "New Features",
                  description:
                    "Agent capabilities, export formats, UX improvements.",
                },
                {
                  icon: ShieldCheck,
                  title: "Safety & Security",
                  description:
                    "Margin tuning, data-freshness gates, dependency updates.",
                },
                {
                  icon: Zap,
                  title: "Performance",
                  description:
                    "Faster planning, better caching, reduced latency.",
                },
              ].map((cat, i) => (
                <div key={i}>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brass/10 text-brass mb-3">
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base mb-1">{cat.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {cat.description}
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
            See What&apos;s Shipped
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            The log is coming. The latest features are live now.
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
