import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { MobileNav } from './components/navigation/MobileNav'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'),
  title: 'Helmwise - Sailing Route Planning',
  description: 'Plan your sailing passages with weather routing, tidal predictions, and comprehensive safety briefings.',
  manifest: '/manifest.json',
  themeColor: '#0ea5e9',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <MobileNav />
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
} 