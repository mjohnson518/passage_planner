
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { AnalyticsDashboard } from '../../components/analytics/AnalyticsDashboard'
import { Header } from '../../components/layout/Header'
import { BarChart3 } from 'lucide-react'

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