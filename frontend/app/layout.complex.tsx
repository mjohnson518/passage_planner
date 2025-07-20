import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Header } from './components/layout/Header'
import { Toaster } from './components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Passage Planner - AI-Powered Sailing Route Planning',
  description: 'Plan your sailing passages with AI-powered weather routing, tidal predictions, and comprehensive safety briefings.',
  keywords: 'sailing, passage planning, weather routing, marine navigation, boat, yacht',
  authors: [{ name: 'Passage Planner Team' }],
  openGraph: {
    title: 'Passage Planner',
    description: 'AI-Powered Sailing Route Planning',
    url: 'https://passageplanner.com',
    siteName: 'Passage Planner',
    images: [
      {
        url: 'https://passageplanner.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Passage Planner',
    description: 'AI-Powered Sailing Route Planning',
    images: ['https://passageplanner.com/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
          <div className="min-h-screen bg-gradient-to-br from-ocean-50 via-white to-sea-50 dark:from-ocean-900 dark:via-gray-900 dark:to-sea-900">
            <Header />
            <main className="relative">
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
} 