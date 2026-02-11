'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { ThemeProvider } from 'next-themes'

const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })),
  { ssr: false }
)
import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { useServiceWorker } from './hooks/useServiceWorker'

function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const { isOffline } = useServiceWorker()

  useEffect(() => {
    // Show offline indicator
    if (isOffline) {
      document.body.classList.add('offline')
    } else {
      document.body.classList.remove('offline')
    }
  }, [isOffline])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <ServiceWorkerProvider>
              {children}
            </ServiceWorkerProvider>
          </SocketProvider>
        </AuthProvider>
        <Toaster richColors closeButton />
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
