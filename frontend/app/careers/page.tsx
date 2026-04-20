import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import {
  Anchor,
  Users,
  ArrowRight,
  Shield,
  Compass,
  Heart,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Careers - Helmwise",
  description:
    "Careers at Helmwise. Join our team building AI-powered passage planning tools for safer maritime navigation.",
};

export default function CareersPage() {
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
          <span className="badge-brass mb-4 inline-block">Careers</span>
          <h1 className="font-display mt-4 text-balance">
            Building the Future of <br />
            <span className="text-gradient">Maritime Safety</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            We&apos;re a small team building AI-powered passage planning for
            mariners who take safety seriously. No open positions listed right
            now — but we&apos;re always interested in talented people.
          </p>
        </div>
      </section>

      {/* Intro card */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="card-nautical p-8 sm:p-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-6">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl mb-4">No Open Roles Yet</h2>
            <p className="text-muted-foreground mb-4">
              We don&apos;t have posted positions right now, but we&apos;re
              always interested in hearing from people who are passionate about
              maritime safety, AI, or both.
            </p>
            <p className="text-muted-foreground mb-8">
              Introduce yourself at{" "}
              <a
                href="mailto:hello@helmwise.co"
                className="text-primary hover:underline font-medium"
              >
                hello@helmwise.co
              </a>{" "}
              — tell us what you&apos;d be excited to work on and why it
              matters.
            </p>

            <div className="divider-nautical" />

            <h3 className="font-display text-lg mb-6 mt-4">
              What we care about
            </h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Shield,
                  label: "Safety-First",
                  description:
                    "Life-safety infrastructure for mariners. Conservative margins, honest worst-case forecasts.",
                },
                {
                  icon: Compass,
                  label: "Transparent",
                  description:
                    "We show our data sources and explain recommendations. No black boxes.",
                },
                {
                  icon: Heart,
                  label: "Craft",
                  description:
                    "Maritime aesthetics, rigorous engineering, and a long memory for edge cases.",
                },
              ].map((item, i) => (
                <div key={i}>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brass/10 text-brass mb-3">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-display text-base mb-1">{item.label}</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
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
            Explore What We&apos;re Building
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            See the platform before you introduce yourself.
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
