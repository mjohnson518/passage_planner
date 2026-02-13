import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/button'
import { Anchor, PenLine, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog - Helmwise',
  description: 'Helmwise blog is coming soon. Maritime safety insights, passage planning tips, and platform updates.',
}

export default function BlogPage() {
  return (
    <>
      <Header />

      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8 flex items-center">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-8">
            <PenLine className="h-8 w-8" />
          </div>
          <h1 className="font-display text-4xl mb-4">Blog Coming Soon</h1>
          <p className="text-lg text-muted-foreground mb-8">
            We&apos;re preparing articles on maritime safety, passage planning best practices, weather interpretation, and platform updates. Stay tuned.
          </p>
          <p className="text-muted-foreground mb-10">
            While you wait, explore the features that make Helmwise the safest way to plan your passages.
          </p>
          <Link href="/features">
            <Button size="lg" className="btn-brass group">
              Explore Features
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
