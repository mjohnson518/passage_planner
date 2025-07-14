import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata = {
  title: 'Passage Planner - Smart Sailing Navigation',
  description: 'AI-powered passage planning for sailors with real-time weather, tides, and route optimization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gradient-subtle dark:bg-gray-950 antialiased">
        {children}
      </body>
    </html>
  )
}
