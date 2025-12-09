import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { MobileNav } from './components/navigation/MobileNav'
import { FeedbackWidget } from './components/FeedbackWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'),
  title: 'Helmwise - AI-Powered Sailing Passage Planning',
  description: 'Plan safer sailing passages with real-time weather routing, tidal predictions, and comprehensive safety briefings. AI agents orchestrate your perfect voyage.',
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Helmwise'
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    title: 'Helmwise - AI-Powered Sailing Passage Planning',
    description: 'Plan safer sailing passages with real-time weather routing, tidal predictions, and comprehensive safety briefings.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Helmwise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helmwise - AI-Powered Sailing Passage Planning',
    description: 'Plan safer sailing passages with real-time weather routing, tidal predictions, and comprehensive safety briefings.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#1a5f8c'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased">
        <Providers>
          <ErrorBoundary>
            <div className="min-h-screen flex flex-col">
              {children}
            </div>
          </ErrorBoundary>
          <MobileNav />
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              className: 'font-body',
              style: {
                borderRadius: 'var(--radius)',
              }
            }}
          />
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  )
}
