import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import {
  Anchor,
  BookOpen,
  ArrowRight,
  Rocket,
  Map,
  Download,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation - Helmwise",
  description:
    "Helmwise documentation is coming soon. Learn how to use AI-powered passage planning for safer maritime navigation.",
  robots: { index: false, follow: true },
};

export default function DocsPage() {
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
            Helmwise <span className="text-gradient">Documentation</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Comprehensive guides, API references, and tutorials to help you get
            the most out of Helmwise. We&apos;re writing them now.
          </p>
        </div>
      </section>

      {/* Sections in progress */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="card-nautical p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl mb-2">
                  Sections in progress
                </h2>
                <p className="text-muted-foreground">
                  Organised around real planning workflows, not buried in menus.
                </p>
              </div>
            </div>

            <div className="divider-nautical" />

            <div className="grid sm:grid-cols-3 gap-6 mt-4">
              {[
                {
                  icon: Rocket,
                  title: "Getting Started",
                  description:
                    "Plan your first passage, understand the agents, read the output.",
                },
                {
                  icon: Map,
                  title: "Planning Workflows",
                  description:
                    "Vessel profiles, waypoint design, tidal windows, weather gates.",
                },
                {
                  icon: Download,
                  title: "Exports & Integrations",
                  description:
                    "GPX, PDF, chartplotter handoff, webhooks, PWA install.",
                },
              ].map((section, i) => (
                <div key={i}>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brass/10 text-brass mb-3">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base mb-1">
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
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
            Learn by Planning
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            The docs are coming. The fastest way to learn is to plan a passage.
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
