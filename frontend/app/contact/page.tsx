import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import {
  Anchor,
  Mail,
  Twitter,
  Github,
  Linkedin,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact - Helmwise",
  description:
    "Get in touch with the Helmwise team. Support, sales, and general inquiries for our AI-powered passage planning platform.",
};

export default function ContactPage() {
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
          <span className="badge-brass mb-4 inline-block">Contact</span>
          <h1 className="font-display mt-4 text-balance">
            Get in <span className="text-gradient">Touch</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Have a question, need help with your passage planning, or want to
            learn more about Helmwise? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                label: "Support",
                email: "support@helmwise.co",
                description:
                  "Technical help, bug reports, and account questions.",
              },
              {
                label: "Sales",
                email: "sales@helmwise.co",
                description:
                  "Pricing, enterprise plans, and partnership inquiries.",
              },
              {
                label: "General",
                email: "hello@helmwise.co",
                description: "Feedback, press, and everything else.",
              },
            ].map((contact, i) => (
              <div
                key={i}
                className="card-nautical p-6 text-center transition-all hover:shadow-card-hover hover:-translate-y-1"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <Mail className="h-6 w-6" />
                </div>
                <h2 className="font-display text-xl mb-2">{contact.label}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {contact.description}
                </p>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  {contact.email}
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="badge-primary mb-4 inline-block">Follow Along</span>
          <h2 className="font-display mt-2 mb-8">Find Us Elsewhere</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              {
                label: "Twitter",
                icon: Twitter,
                href: "https://twitter.com/helmwise",
              },
              {
                label: "GitHub",
                icon: Github,
                href: "https://github.com/helmwise",
              },
              {
                label: "LinkedIn",
                icon: Linkedin,
                href: "https://linkedin.com/company/helmwise",
              },
            ].map((social, i) => (
              <a
                key={i}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium transition-all hover:border-primary/40 hover:text-primary hover:shadow-maritime"
              >
                <social.icon className="h-5 w-5" />
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-ocean px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-primary-foreground">
            Ready to Plan Your Next Passage?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Try Helmwise free and see how AI-powered passage planning works.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="btn-brass group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/features">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Explore Features
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
