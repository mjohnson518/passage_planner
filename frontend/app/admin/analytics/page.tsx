
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { Header } from '../../components/layout/Header'
import { BarChart3 } from 'lucide-react'

const AnalyticsDashboard = dynamic(
  () => import('../../components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    ),
  }
)

export default function AnalyticsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check if user is admin
    if (!user) {
      router.push('/login')
      return
    }

    // Admin check - in production this would be role-based
    const adminEmails = ['admin@helmwise.co', 'marc@example.com']
    const hasAdminAccess = 
      adminEmails.includes(user.email || '')

    if (!hasAdminAccess) {
      router.push('/dashboard')
      return
    }

    setIsAdmin(true)
  }, [user, router])

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <AnalyticsDashboard />
      </main>
    </div>
  )
} 