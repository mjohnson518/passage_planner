import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { MobileNav } from './components/navigation/MobileNav'
import { FeedbackWidget } from './components/FeedbackWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'),
  title: 'Helmwise - Sailing Passage Planning',
  description: 'Plan your sailing passages with weather routing, tidal predictions, and comprehensive safety briefings.',
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
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0ea5e9'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <MobileNav />
          <Toaster richColors position="top-right" />
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  )
} 