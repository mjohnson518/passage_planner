'use client'

import { Suspense, lazy, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { ResponsiveCard } from '../components/ui/responsive-card'
import { Skeleton } from '../components/ui/skeleton'
import { Map, Calendar, Wind, Anchor, TrendingUp, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAnalytics, ANALYTICS_EVENTS } from '../hooks/useAnalytics'
import { preloadCriticalResources, deduplicatedFetch } from '../lib/performance'

// Lazy load heavy components
const DemoPassage = lazy(async () => ({ default: (await import('../components/demo/DemoPassage')).DemoPassage }))
// Fallback to simple inline placeholders when widgets are unavailable
const WeatherWidget = lazy(async () => ({ default: () => <div className="h-48 w-full rounded-md glass flex items-center justify-center text-sm text-muted-foreground">Weather widget coming soon</div> }))
const RecentPassages = lazy(async () => ({ default: () => <div className="h-64 w-full rounded-md glass flex items-center justify-center text-sm text-muted-foreground">Recent passages coming soon</div> }))

// Loading skeletons
function DemoPassageSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16 mt-2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export default function OptimizedDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { track, trackFeature } = useAnalytics()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Track page view
    track(ANALYTICS_EVENTS.PAGE_VIEW, { page: 'dashboard' })
    
    // Preload critical resources
    preloadCriticalResources()
    
    // Load stats with deduplication
    loadDashboardStats()
  }, [user])

  const loadDashboardStats = async () => {
    try {
      const data = await deduplicatedFetch(
        `dashboard-stats-${user?.id}`,
        async () => {
          const response = await fetch('/api/dashboard/stats', {
            headers: {
              'Authorization': `Bearer ${await user?.getIdToken()}`
            }
          })
          return response.json()
        },
        60000 // Cache for 1 minute
      )
      
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewPassage = () => {
    trackFeature('new_passage_clicked', { source: 'dashboard' })
    router.push('/planner')
  }

  if (!user) return null

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-20 md:pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Button onClick={handleNewPassage} className="hidden md:flex">
          <Plus className="mr-2 h-4 w-4" />
          New Passage
        </Button>
      </div>

      {/* Stats Overview with loading state */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ResponsiveCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Passages</CardTitle>
              <Map className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPassages || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.monthlyPassages || 0} this month
              </p>
            </CardContent>
          </ResponsiveCard>
          
          <ResponsiveCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Miles Planned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMiles || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across all passages
              </p>
            </CardContent>
          </ResponsiveCard>
          
          <ResponsiveCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favorite Port</CardTitle>
              <Anchor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.favoritePort || 'N/A'}</div>
              <p className="text-xs text-muted-foreground">
                Most visited destination
              </p>
            </CardContent>
          </ResponsiveCard>
          
          <ResponsiveCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weather Score</CardTitle>
              <Wind className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.weatherScore || 0}%</div>
              <p className="text-xs text-muted-foreground">
                Favorable conditions
              </p>
            </CardContent>
          </ResponsiveCard>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleNewPassage}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Plan New Passage
            </CardTitle>
            <CardDescription>
              Create a new sailing route with weather analysis
            </CardDescription>
          </CardHeader>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/passages')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              View Passages
            </CardTitle>
            <CardDescription>
              Browse and manage your planned routes
            </CardDescription>
          </CardHeader>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/weather')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              Weather Maps
            </CardTitle>
            <CardDescription>
              Check current conditions and forecasts
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Demo Passage with lazy loading */}
      <Suspense fallback={<DemoPassageSkeleton />}>
        <DemoPassage />
      </Suspense>

      {/* Recent Passages with lazy loading */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RecentPassages />
      </Suspense>

      {/* Weather Widget with lazy loading */}
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <WeatherWidget />
      </Suspense>

      {/* Mobile FAB */}
      <Button
        size="lg"
        className="md:hidden fixed bottom-20 right-4 rounded-full shadow-lg z-10"
        onClick={handleNewPassage}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
} 