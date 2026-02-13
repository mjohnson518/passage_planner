import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import { Anchor, Mail, Twitter, Github, Linkedin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact - Helmwise',
  description: 'Get in touch with the Helmwise team. Support, sales, and general inquiries for our AI-powered passage planning platform.',
}

export default function ContactPage() {
  return (
    <>
      <Header />

      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">

          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="font-display text-4xl mb-4">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have a question, need help with your passage planning, or want to learn more about Helmwise? We&apos;d love to hear from you.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid gap-8 sm:grid-cols-3 mb-16">
            {[
              {
                label: 'Support',
                email: 'support@helmwise.co',
                description: 'Technical help, bug reports, and account questions.',
              },
              {
                label: 'Sales',
                email: 'sales@helmwise.co',
                description: 'Pricing, enterprise plans, and partnership inquiries.',
              },
              {
                label: 'General',
                email: 'hello@helmwise.co',
                description: 'Feedback, press, and everything else.',
              },
            ].map((contact, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-6 text-center hover:border-primary/30 transition-colors">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <Mail className="h-6 w-6" />
                </div>
                <h2 className="font-display text-xl mb-2">{contact.label}</h2>
                <p className="text-sm text-muted-foreground mb-4">{contact.description}</p>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-primary hover:underline font-medium"
                >
                  {contact.email}
                </a>
              </div>
            ))}
          </div>

          {/* Social Links */}
          <div className="text-center">
            <h2 className="font-display text-2xl mb-6">Follow Us</h2>
            <div className="flex justify-center gap-6">
              {[
                {
                  label: 'Twitter',
                  icon: Twitter,
                  href: 'https://twitter.com/helmwise',
                },
                {
                  label: 'GitHub',
                  icon: Github,
                  href: 'https://github.com/helmwise',
                },
                {
                  label: 'LinkedIn',
                  icon: Linkedin,
                  href: 'https://linkedin.com/company/helmwise',
                },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <social.icon className="h-5 w-5" />
                  {social.label}
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

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
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
