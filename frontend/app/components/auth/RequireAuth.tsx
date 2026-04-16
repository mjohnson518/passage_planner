'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface RequireAuthProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(pathname || '/')
      router.replace(`/login?redirect=${redirect}`)
    }
  }, [loading, user, pathname, router])

  if (loading) {
    return (
      fallback ?? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
