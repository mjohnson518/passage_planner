import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/button'
import { Anchor, Users, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Careers - Helmwise',
  description: 'Careers at Helmwise. Join our team building AI-powered passage planning tools for safer maritime navigation.',
}

export default function CareersPage() {
  return (
    <>
      <Header />

      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8 flex items-center">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-8">
            <Users className="h-8 w-8" />
          </div>
          <h1 className="font-display text-4xl mb-4">Careers Coming Soon</h1>
          <p className="text-lg text-muted-foreground mb-8">
            We&apos;re building the future of maritime passage planning. While we don&apos;t have open positions listed yet, we&apos;re always interested in hearing from talented people who are passionate about maritime safety and AI.
          </p>
          <p className="text-muted-foreground mb-10">
            Check back soon for openings, or reach out to us at{' '}
            <a href="mailto:hello@helmwise.co" className="text-primary hover:underline">hello@helmwise.co</a>{' '}
            to introduce yourself.
          </p>
          <Link href="/contact">
            <Button size="lg" className="btn-brass group">
              Contact Us
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
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
