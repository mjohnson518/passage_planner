import type { Metadata, Viewport } from 'next'
import { Libre_Baskerville, Source_Sans_3 } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { MobileNav } from './components/navigation/MobileNav'
import { FeedbackWidget } from './components/FeedbackWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import './globals.css'

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

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
    <html lang="en" suppressHydrationWarning className={`${libreBaskerville.variable} ${sourceSans.variable} scroll-smooth`}>
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
