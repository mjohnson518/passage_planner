export const dynamic = 'force-dynamic'

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { AgentHealthDashboard } from '../../components/monitoring/AgentHealthDashboard'
import { Header } from '../../components/layout/Header'
import { Shield } from 'lucide-react'

export default function AgentMonitoringPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check if user is admin (you'd implement proper role checking)
    // For now, we'll check if they have a Pro subscription or specific email
    if (!user) {
      router.push('/login')
      return
    }

    // Example admin check - replace with proper role-based access control
    const adminEmails = ['admin@passageplanner.com', 'marc@example.com']
    const hasAdminAccess = adminEmails.includes(user.email || '')

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
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <AgentHealthDashboard />
      </main>
    </div>
  )
} 