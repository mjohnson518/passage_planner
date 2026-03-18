import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Source_Sans_3, Roboto_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { MobileNav } from './components/navigation/MobileNav'
import { FeedbackWidget } from './components/FeedbackWidget'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CookieConsent } from './components/legal/CookieConsent'
import './globals.css'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
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
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Helmwise — AI-powered maritime passage planning',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helmwise - AI-Powered Sailing Passage Planning',
    description: 'Plan safer sailing passages with real-time weather routing, tidal predictions, and comprehensive safety briefings.',
    images: ['/og-image.png'],
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
    <html lang="en" suppressHydrationWarning className={`${playfairDisplay.variable} ${sourceSans.variable} ${robotoMono.variable} scroll-smooth`}>
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
          <InstallPrompt />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  )
}
